import sys, json, time
from ortools.sat.python import cp_model

def main():
    data = json.load(sys.stdin)
    slots = data["slots"]; units = data["units"]; pair = {int(k): v for k, v in data["pair"].items()}
    model = cp_model.CpModel()
    x = {}
    occ = {}  # (unit, start) -> [slot indexes]
    for i, u in enumerate(units):
        vars_ = []
        for s in u["candidates"]:
            v = model.NewBoolVar(f"x_{i}_{s}")
            x[(i, s)] = v; vars_.append(v)
            occ[(i, s)] = [s, pair[s]] if u["size"] == 2 else [s]
        model.AddExactlyOne(vars_)
    # bentrok guru & kelas per slot terisi
    from collections import defaultdict
    tslot = defaultdict(list); cslot = defaultdict(list)
    tday = defaultdict(list); aday = defaultdict(list)
    for (i, s), v in x.items():
        u = units[i]; day = slots[s]["day"]
        for oi in occ[(i, s)]:
            tslot[(u["teacher_id"], oi)].append(v)
            cslot[(u["class_id"], oi)].append(v)
        tday[(u["teacher_id"], day)].append((u["size"], v))
        aday[(u["assignment_id"], day)].append((u["size"], v))
    for d in (tslot, cslot):
        for vs in d.values():
            if len(vs) > 1: model.Add(sum(vs) <= 1)
    for (tid, _), lst in tday.items():
        mx = data["teacher_max_day"].get(str(tid), 0)
        if mx: model.Add(sum(sz * v for sz, v in lst) <= mx)
    for (aid, _), lst in aday.items():
        mx = data["assignment_max_day"].get(str(aid), 0)
        if mx: model.Add(sum(sz * v for sz, v in lst) <= mx)
    # ---- soft (hanya dibangun bila diminta optimize_soft; default: cari layak dulu) ----
    w = data["weights"]; terms = []
    if not data.get("optimize_soft"): terms = None
    # sore untuk mapel pagi
    for (i, s), v in x.items():
        if units[i]["prefer_pagi"]:
            c = sum(1 for oi in occ[(i, s)] if slots[oi]["period"] >= 7)
            if c and terms is not None: terms.append(w["sore"] * c * v)
    # sebar: penugasan >2 JP/hari
    for key, lst in aday.items():
        load = sum(sz * v for sz, v in lst)
        ex = model.NewIntVar(0, sum(sz for sz, _ in lst), f"ex_{key[0]}_{key[1]}")
        model.Add(load - ex <= 2)
        if terms is not None: terms.append(w["sebar"] * ex)
    # celah guru: y[t,day,period]=mengajar; g[period tengah]=celah bila ada ajar sebelum & sesudah
    y = {}
    periods_by_day = {}
    for idx, s in enumerate(slots): periods_by_day.setdefault(s["day"], []).append((s["period"], idx))
    tperiod = defaultdict(list)
    for (i, s), v in x.items():
        for oi in occ[(i, s)]:
            sl = slots[oi]; tperiod[(units[i]["teacher_id"], sl["day"], sl["period"])].append(v)
    for (tid, day, per), vs in tperiod.items():
        yv = model.NewBoolVar(f"y_{tid}_{day}_{per}")
        y[(tid, day, per)] = yv
        for v in vs: model.Add(yv >= v)
        model.Add(yv <= sum(vs))
    days = sorted(periods_by_day.keys())
    teacher_ids = sorted({u["teacher_id"] for u in units})
    for tid in teacher_ids:
        for day in days:
            ps = sorted({p for p, _ in periods_by_day[day]})
            for k in range(1, len(ps) - 1):
                before = [y.get((tid, day, p)) for p in ps[:k]]
                after = [y.get((tid, day, p)) for p in ps[k+1:]]
                before = [v for v in before if v is not None]; after = [v for v in after if v is not None]
                if not before or not after: continue
                g = model.NewBoolVar(f"g_{tid}_{day}_{ps[k]}")
                for a in before:
                    for b in after: model.Add(g >= a + b - 1)
                if terms is not None: terms.append(w["gap"] * g)
    if terms: model.Minimize(sum(terms))  # tanpa objektif: solver berhenti pada solusi layak pertama
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(data["time_limit"])
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)
    name = solver.StatusName(status)
    assign = [-1] * len(units)
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for i, u in enumerate(units):
            for s in u["candidates"]:
                if solver.Value(x[(i, s)]): assign[i] = s; break
    print(json.dumps({"status": name, "assign": assign}))

if __name__ == "__main__":
    main()
