/* ===== Money Game: LocalServer (the game's backend, running on this device for now) =====
   The old Python server (bet, race result, balances, /api/*) lives here as plain functions. Every function is
   registered under a stable name, so a real server can implement the same names later (POST /api/<name>):

   racer.config  {}                                   -> {enabled, minBet, maxBet, odds:{2,3}, playerWinPct, mode, wallet:"games"}
   racer.state   {boot?:bool}                         -> {balance, mode, config, seeded, pending, seq}
                   boot:true settles a bet left open by a race that never finished (app closed mid-race).
                   Demo only: the first open moves 1,000 USDT Spot -> Money Game once if that wallet is empty.
   racer.bet     {amount, cars:2|3, car, field:[car..], drive:"auto"|"manual", len}
                                                      -> {betId, raceId, no, car, cars, amount, mult, target, balance}
                   Debits the stake from the Money Game wallet (wallet.debit). target = the car the race is set
                   to be won by in Car Bet (auto) mode: fair uniform pick, or admin playerWinPct (0-100) for the
                   player's car. Manual Drive has no target (the finish line decides).
   racer.settle  {betId, winner, rank, fin}           -> {betId, win, payout, mult, balance, bet, race}
                   Idempotent. winner = car that crossed the line first. Credits amount*mult on a win (wallet.credit).
   racer.history {limit?}                             -> {bets, races, tx, balance}

   Data (localStorage, key = ACCT.key("nt_racer")): {bets:[{id, raceId, car, cars, amount, mult, win, payout, mode, t, drive, rank}],
     races:[{id, winner, cars, dur, t, fin, car}], tx:[{type:"in"|"out", amt, t, from, to}], seq, pending, seeded}
   Money moves only through the host's wallet calls ("wallet.balance" / "wallet.debit" / "wallet.credit" / "wallet.transfer").

   host = { mode():"demo"|"real", key(name), admin():{...racer admin settings}, call(name, data):Promise, now?() } */
(function (g) {
  'use strict';
  const CARS = ['red', 'blue', 'yellow'];
  const DEF = { enabled: true, minBet: 1, maxBet: 1000, odds2: 1.9, odds3: 2.5, playerWinPct: null };
  const CAP = 300;
  const r2 = (x) => Math.round((+x || 0) * 100) / 100;
  const rnd = () => { try { const u = new Uint32Array(1); g.crypto.getRandomValues(u); return u[0] / 4294967296; } catch (e) { return Math.random(); } };

  function create(host) {
    const KEY = () => host.key('nt_racer');
    const now = () => (host.now ? host.now() : Date.now());
    function load() {
      let o = {};
      try { o = JSON.parse(localStorage.getItem(KEY()) || '{}') || {}; } catch (e) {}
      return { bets: o.bets || [], races: o.races || [], tx: o.tx || [], seq: o.seq || 0, pending: o.pending || null, seeded: !!o.seeded };
    }
    function save(d) {
      ['bets', 'races', 'tx'].forEach((k) => { if (d[k].length > CAP) d[k].length = CAP; });
      try { localStorage.setItem(KEY(), JSON.stringify(d)); } catch (e) {}
    }
    function config() {
      const a = Object.assign({}, DEF, host.admin() || {});
      const num = (v, d) => (isFinite(+v) && +v > 0 ? +v : d);
      return {
        enabled: a.enabled !== false,
        minBet: num(a.minBet, DEF.minBet), maxBet: num(a.maxBet, DEF.maxBet),
        odds: { 2: num(a.odds2, DEF.odds2), 3: num(a.odds3, DEF.odds3) },
        playerWinPct: (a.playerWinPct === null || a.playerWinPct === '' || !isFinite(+a.playerWinPct)) ? null : Math.max(0, Math.min(100, +a.playerWinPct)),
        mode: host.mode(), wallet: 'games'
      };
    }
    const balance = async () => r2((await host.call('wallet.balance', { wallet: 'games' })).balance);

    // the race decides: settle and store one bet (used by racer.settle and for an orphaned bet)
    async function settleBet(d, p, winner, rank, fin) {
      const win = winner === p.car;
      const payout = win ? r2(p.amount * p.mult) : (p.refund ? r2(p.amount) : 0);
      if (payout > 0) await host.call('wallet.credit', { wallet: 'games', amount: payout, reason: win ? 'Money Game win' : 'Money Game refund' });
      const t = now();
      const bet = { id: p.betId, raceId: p.raceId, car: p.car, cars: p.cars, amount: p.amount, mult: p.mult, win, payout, mode: p.mode, t, drive: p.drive, rank: rank || (win ? 1 : null) };
      if (p.refund) bet.refunded = true;
      const race = { id: p.raceId, winner: winner || null, cars: p.cars, dur: p.len, t, fin: fin ? r2(fin) : null, car: p.car };
      d.bets.unshift(bet); d.races.unshift(race);
      d.pending = null;
      return { bet, race, win, payout };
    }
    async function settleOrphan(d) {
      const p = d.pending; if (!p) return null;
      // never finished on screen: Car Bet uses the winner the race was set up with, Manual Drive refunds the stake
      if (p.target) return settleBet(d, p, p.target, p.target === p.car ? 1 : 2, null);
      p.refund = true;
      return settleBet(d, p, null, null, null);
    }

    const H = {
      'racer.config': async () => config(),
      'racer.state': async (q) => {
        q = q || {};
        const d = load(), c = config();
        if (d.pending && (q.boot || now() - d.pending.t > ((d.pending.len || 60) + 180) * 1000)) { await settleOrphan(d); save(d); }
        if (!d.seeded && host.mode() === 'demo' && host.seed) {
          d.seeded = true; save(d);            // saved first: the seed transfer is logged into nt_racer.tx by the app
          try { await host.seed(); } catch (e) {}
        }
        return { balance: await balance(), mode: host.mode(), config: c, seeded: d.seeded, pending: d.pending, seq: d.seq };
      },
      'racer.bet': async (q) => {
        const c = config();
        if (!c.enabled) throw new Error('Money Game is under maintenance');
        const amount = r2(q.amount), cars = +q.cars === 2 ? 2 : 3;
        const car = CARS.includes(q.car) ? q.car : 'red';
        if (!(amount >= c.minBet && amount <= c.maxBet)) throw new Error(`Bet must be ${c.minBet}–${c.maxBet} USDT`);
        const d = load();
        if (d.pending) await settleOrphan(d);
        let field = Array.isArray(q.field) ? q.field.filter((k) => CARS.includes(k)) : [];
        if (field.length !== cars || !field.includes(car)) field = [car].concat(CARS.filter((k) => k !== car)).slice(0, cars);
        await host.call('wallet.debit', { wallet: 'games', amount, reason: 'Money Game bet' }); // throws "Insufficient balance"
        d.seq += 1;
        const no = d.seq, t = now();
        const drive = q.drive === 'manual' ? 'manual' : 'auto';
        let target = null;
        if (drive === 'auto') {
          const others = field.filter((k) => k !== car);
          if (c.playerWinPct != null) target = rnd() * 100 < c.playerWinPct ? car : others[Math.floor(rnd() * others.length)];
          else target = field[Math.floor(rnd() * field.length)];
        }
        const p = { betId: 'B' + String(100000 + no), raceId: 'R' + String(100000 + no), no, car, cars, field, amount, mult: c.odds[cars], drive, target, mode: host.mode(), len: +q.len || 60, t };
        d.pending = p;
        save(d);
        return { betId: p.betId, raceId: p.raceId, no, car, cars, amount, mult: p.mult, target, balance: await balance() };
      },
      'racer.settle': async (q) => {
        const d = load();
        const p = d.pending;
        if (!p || p.betId !== q.betId) {
          const done = d.bets.find((b) => b.id === q.betId);
          if (done) return { betId: done.id, win: done.win, payout: done.payout, mult: done.mult, balance: await balance(), bet: done, already: true };
          throw new Error('Bet not found');
        }
        const winner = CARS.includes(q.winner) ? q.winner : (p.target || p.field[0]);
        const r = await settleBet(d, p, winner, +q.rank || null, +q.fin || null);
        save(d);
        return { betId: p.betId, win: r.win, payout: r.payout, mult: p.mult, balance: await balance(), bet: r.bet, race: r.race };
      },
      'racer.history': async (q) => {
        const d = load(), n = Math.max(1, Math.min(CAP, +(q && q.limit) || 100));
        return { bets: d.bets.slice(0, n), races: d.races.slice(0, n), tx: d.tx.slice(0, n), balance: await balance() };
      }
    };
    return {
      handlers: H,
      call: (name, data) => (H[name] ? H[name](data || {}) : Promise.reject(new Error('No handler for ' + name))),
      install(api) { Object.keys(H).forEach((k) => api.register(k, H[k])); },
      load, save, config
    };
  }

  // stats for Admin: totals per mode from stored bets
  function stats(d) {
    const o = { bets: 0, wins: 0, losses: 0, wagered: 0, paid: 0, houseProfit: 0, winRate: 0, races: d.races.length, transferIn: 0, transferOut: 0, demo: { bets: 0, wagered: 0, paid: 0 }, real: { bets: 0, wagered: 0, paid: 0 } };
    d.bets.forEach((b) => {
      o.bets++; if (b.win) o.wins++; else if (!b.refunded) o.losses++;
      o.wagered += +b.amount || 0; o.paid += +b.payout || 0;
      const m = o[b.mode === 'real' ? 'real' : 'demo']; m.bets++; m.wagered += +b.amount || 0; m.paid += +b.payout || 0;
    });
    d.tx.forEach((x) => { if (x.type === 'in') o.transferIn += +x.amt || 0; else o.transferOut += +x.amt || 0; });
    ['wagered', 'paid', 'transferIn', 'transferOut'].forEach((k) => { o[k] = r2(o[k]); });
    o.houseProfit = r2(o.wagered - o.paid);
    o.winRate = o.bets ? Math.round((o.wins / o.bets) * 1000) / 10 : 0;
    return o;
  }

  g.MoneyRacerServer = { create, stats, DEF };
})(window);
