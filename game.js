// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const ROWS = 5, COLS = 6;
const SCATTER = '🤴';
const SYMBOLS = ['🍒','🍋','🍇','🍉','🍊','🍓','🍑','🍍'];
const WEIGHTS = [10,10,10,10,10,10,10,10]; // perfectly equal — combinations very rare
const FS_MULT = 100;

const delay = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);

// ─────────────────────────────────────────────
// SYMBOL → IMAGE mapping
// Keys match the SYMBOLS array; scatter keeps emoji fallback
// ─────────────────────────────────────────────
const SYMBOL_IMAGES = {
  '🍒': 'assets/Blueberry.png',
  '🍋': 'assets/cherry.png',
  '🍇': 'assets/grapes.png',
  '🍉': 'assets/banana.png',
  '🍊': 'assets/orange.png',
  '🍓': 'assets/Strawberry.png',
  '🍑': 'assets/apple.png',
  '🍍': 'assets/pinapple.png',
  '🤴': 'assets/scatter.png',
};

// Sets a tile's visual — image if available, emoji text as fallback
function setTileSymbol(tile, sym) {
  const src = SYMBOL_IMAGES[sym];
  if (src) {
    tile.textContent = '';
    let img = tile.querySelector('img.sym-img');
    if (!img) {
      img = document.createElement('img');
      img.className = 'sym-img';
      tile.appendChild(img);
    }
    img.src = src;
    img.alt = sym;
    tile.dataset.sym = sym;
  } else {
    // Scatter or unknown — use emoji
    const img = tile.querySelector('img.sym-img');
    if (img) img.remove();
    tile.textContent = sym;
    tile.dataset.sym = sym;
  }
}

// ─────────────────────────────────────────────
// CLASS: SymbolGenerator
// Handles random symbol generation.
// ─────────────────────────────────────────────
class SymbolGenerator {
  constructor(symbols, weights, scatter, scatterChance = 0.12) {
    this.symbols = symbols;
    this.weights = weights;
    this.scatter = scatter;
    this.scatterChance = scatterChance;
    this.totalWeight = weights.reduce((a, b) => a + b, 0);
  }

  random(boosted = false) {
    const chance = boosted ? 0.10 : this.scatterChance;
    if (Math.random() < chance) return this.scatter;
    let r = Math.random() * this.totalWeight;
    for (let i = 0; i < this.symbols.length; i++) {
      r -= this.weights[i];
      if (r <= 0) return this.symbols[i];
    }
    return this.symbols.at(-1);
  }

  multiplier(sym, count) {
    // Per-symbol payout table: [x12+, x10-11, x8-9]
    // Symbols: 🍒 🍋 🍇 🍉 🍊 🍓 🍑 🍍
    const payouts = [
      [500, 250, 100], // 🍒 Cherry
      [250, 100,  25], // 🍋 Lemon
      [150,  50,  20], // 🍇 Grapes
      [120,  20,  15], // 🍉 Watermelon
      [100,  15,  10], // 🍊 Orange
      [ 80,  12,   8], // 🍓 Strawberry
      [ 50,  10,   5], // 🍑 Peach
      [ 40,   9,   4], // 🍍 Pineapple
    ];
    const idx = this.symbols.indexOf(sym);
    const table = payouts[idx] || [20, 7, 2];
    if (count >= 12) return table[0];
    if (count >= 10) return table[1];
    return table[2]; // 8-9
  }
}

// ─────────────────────────────────────────────
// CLASS: ReelColumn
// Manages a single reel column: DOM + animation.
// ─────────────────────────────────────────────
class ReelColumn {
  constructor(colIndex, tileH, generator) {
    this.index = colIndex;
    this.tileH = tileH;
    this.generator = generator;
    this.tiles = [];

    this.el = Object.assign(document.createElement('div'), {
      className: 'reel-col',
      id: 'col_' + colIndex
    });
    this.el.style.cssText = 'position:relative;overflow:hidden;';

    for (let r = 0; r < ROWS; r++) {
      const t = document.createElement('div');
      t.className = 'reel-tile';
      t.style.cssText = `height:${tileH}px;position:absolute;left:0;right:0;top:${r * tileH}px;`;
      setTileSymbol(t, generator.random());
      this.el.appendChild(t);
      this.tiles.push(t);
    }
  }

  async roll(finals, duration, isFree = false) {
    const { el, tiles, tileH, generator } = this;
    const SCROLL_ROWS = 8;
    const strip = document.createElement('div');
    strip.style.cssText = 'position:absolute;left:0;right:0;';

    for (let r = 0; r < SCROLL_ROWS; r++) {
      const t = document.createElement('div');
      t.className = 'reel-tile';
      t.style.cssText = `height:${tileH}px;position:relative;`;
      setTileSymbol(t, generator.random());
      strip.appendChild(t);
    }
    for (let r = 0; r < ROWS; r++) {
      const t = document.createElement('div');
      t.className = 'reel-tile';
      t.style.cssText = `height:${tileH}px;position:relative;`;
      setTileSymbol(t, finals[r]);
      strip.appendChild(t);
    }
    for (let r = 0; r < ROWS; r++) {
      const t = document.createElement('div');
      t.className = 'reel-tile';
      t.style.cssText = `height:${tileH}px;position:relative;`;
      setTileSymbol(t, tiles[r].dataset.sym || tiles[r].textContent);
      strip.appendChild(t);
    }

    const startY = -(SCROLL_ROWS + ROWS) * tileH;
    strip.style.top = startY + 'px';
    tiles.forEach(t => t.style.visibility = 'hidden');
    el.appendChild(strip);

    await new Promise(resolve => {
      let startTime = null;
      function tick(ts) {
        if (!startTime) startTime = ts;
        const elapsed = Math.min(ts - startTime, duration);
        const progress = elapsed / duration;
        const eased = progress < 0.8
          ? progress / 0.8 * 0.8
          : 0.8 + (1 - (1 - (progress - 0.8) / 0.2) * (1 - (progress - 0.8) / 0.2)) * 0.2;
        strip.style.top = (startY + (0 - startY) * eased) + 'px';
        if (elapsed < duration) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });

    finals.forEach((s, r) => { setTileSymbol(tiles[r], s); tiles[r].style.top = (r * tileH) + 'px'; });
    tiles.forEach(t => t.style.visibility = '');
    el.removeChild(strip);

    await new Promise(resolve => {
      let st = null;
      const bounceH = tileH * 0.055, bounceMs = 130;
      function tick(ts) {
        if (!st) st = ts;
        const p = Math.min((ts - st) / bounceMs, 1);
        const y = bounceH * Math.sin(p * Math.PI);
        tiles.forEach((t, r) => { t.style.top = (r * tileH + y) + 'px'; });
        if (p < 1) requestAnimationFrame(tick);
        else { tiles.forEach((t, r) => { t.style.top = (r * tileH) + 'px'; }); resolve(); }
      }
      requestAnimationFrame(tick);
    });
  }

  clearWinMarks() {
    this.tiles.forEach(t => {
      t.classList.remove('winner', 'scatter-tile');
      delete t.dataset.count;
      delete t.dataset.sym;
    });
  }

  getTile(row) {
    return this.tiles[row];
  }
}

// ─────────────────────────────────────────────
// CLASS: Grid
// Manages all reel columns together.
// ─────────────────────────────────────────────
class Grid {
  constructor(gridEl, generator) {
    this.el = gridEl;
    this.generator = generator;
    this.columns = [];
  }

  build() {
    this.el.innerHTML = '';
    this.columns = [];
    const tileH = (this.el.getBoundingClientRect().height || 450 - (ROWS - 1) * 6) / ROWS;
    for (let c = 0; c < COLS; c++) {
      const col = new ReelColumn(c, tileH, this.generator);
      this.el.appendChild(col.el);
      this.columns.push(col);
    }
  }

  clearWins() {
    this.el.classList.remove('has-winners');
    this.columns.forEach(col => col.clearWinMarks());
  }

  async spin(finals, baseDelay, baseDur, isFree) {
    await Promise.all(
      this.columns.map((col, c) =>
        delay(c * baseDelay).then(() =>
          col.roll(finals.map(r => r[c]), baseDur + c * (isFree ? 80 : 120), isFree)
        )
      )
    );
  }

  getTile(row, col) {
    return this.columns[col]?.getTile(row);
  }

  markWinner(row, col, count) {
    const tile = this.getTile(row, col);
    if (tile) { tile.classList.add('winner'); tile.dataset.count = count; }
  }

  markScatter(row, col) {
    const tile = this.getTile(row, col);
    if (tile) tile.classList.add('scatter-tile');
  }

  setHasWinners(val) {
    this.el.classList.toggle('has-winners', val);
  }
}

// ─────────────────────────────────────────────
// CLASS: ParticleSystem
// Spawns win particles.
// ─────────────────────────────────────────────
class ParticleSystem {
  constructor(containerEl) {
    this.container = containerEl;
  }

  spawn(big = false) {
    const cols = big
      ? ['#ffd700','#fff700','#ffaa00','#fff','#ffe566']
      : ['#ffd700','#ff6b35','#fff','#c8ff00','#ff9500'];
    for (let i = 0; i < (big ? 80 : 30); i++) {
      const p = Object.assign(document.createElement('div'), { className: 'particle' });
      Object.assign(p.style, {
        left: Math.random() * 100 + 'vw',
        top: '-10px',
        background: cols[Math.random() * cols.length | 0],
        animationDelay: Math.random() * (big ? 1.5 : 0.8) + 's',
        animationDuration: (big ? 1.5 + Math.random() * 1.5 : 1 + Math.random()) + 's'
      });
      if (big) p.style.width = p.style.height = (6 + Math.random() * 10) + 'px';
      this.container.appendChild(p);
      setTimeout(() => p.remove(), big ? 4000 : 2500);
    }
  }
}

// ─────────────────────────────────────────────
// CLASS: UIManager
// Manages all DOM updates for balance, bet, win display, overlays, etc.
// ─────────────────────────────────────────────
class UIManager {
  constructor() {
    this.els = {
      balance: $('balanceDisplay'),
      bet: $('betAmount'),
      win: $('winDisplay'),
      winMessage: $('winMessage'),
      winText: $('winText'),
      spinBtn: $('spinBtn'),
      fsCount: $('fsCount'),
      fsSummaryWin: $('fsSummaryWin'),
      freeSpinHUD: $('freeSpinHUD'),
      buyModalCost: $('buyModalCost'),
      buyModalFormula: $('buyModalFormula'),
      buyPurchaseBtn: $('buyPurchaseBtn'),
      buyModal: $('buyModal'),
      buyConfirmIcon: $('buyConfirmIcon'),
      buyConfirmTitle: $('buyConfirmTitle'),
      buyConfirmSub: $('buyConfirmSub'),
      buyConfirmCost: $('buyConfirmCost'),
    };
  }

  updateBalance(balance) {
    this.els.balance.textContent = '$' + balance.toFixed(2);
  }

  updateBet(bet) {
    this.els.bet.textContent = bet;
  }

  updateWinDisplay(amount) {
    this.els.win.textContent = '$' + amount.toFixed(2);
  }

  setSpinButton(enabled, label = null) {
    this.els.spinBtn.disabled = !enabled;
    if (label) this.els.spinBtn.textContent = label;
  }

  setFSCount(n) {
    this.els.fsCount.textContent = n;
  }

  setFSSummaryWin(amount) {
    this.els.fsSummaryWin.textContent = '$' + amount.toFixed(2);
  }

  showFSHUD(visible) {
    this.els.freeSpinHUD.style.display = visible ? 'flex' : 'none';
  }

  showWinMessage(text) {
    this.els.winText.textContent = text;
    const m = this.els.winMessage;
    m.classList.add('show');
    setTimeout(() => m.classList.remove('show'), 2000);
  }

  // Animated counting win overlay for Big Win / Mega Win
  showBigWinCounting(amount, isMega) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'bigwin-overlay';
      overlay.innerHTML = `
        <div class="bigwin-box ${isMega ? 'megawin' : ''}">
          <div class="bigwin-label">${isMega ? '🏆 MEGA WIN!' : '✨ BIG WIN!'}</div>
          <div class="bigwin-amount">$<span class="bigwin-num">0</span></div>
          <div class="bigwin-shine"></div>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('show'));

      const numEl = overlay.querySelector('.bigwin-num');
      const duration = 1800;
      let start = null;
      const tick = ts => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        // Ease out expo
        const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        numEl.textContent = (amount * eased).toFixed(2);
        if (p < 1) { requestAnimationFrame(tick); }
        else {
          numEl.textContent = amount.toFixed(2);
          setTimeout(() => {
            overlay.classList.remove('show');
            setTimeout(() => { overlay.remove(); resolve(); }, 400);
          }, 800);
        }
      };
      requestAnimationFrame(tick);
    });
  }

  updateBuyModal(bet, fsMult, balance) {
    const cost = bet * fsMult;
    this.els.buyModalCost.textContent = '$' + cost;
    this.els.buyModalFormula.textContent = `${fsMult}× current bet ($${bet})`;
    this.els.buyPurchaseBtn.disabled = balance < cost;
  }

  openBuyModal() {
    this.els.buyModal.classList.add('open');
  }

  closeBuyModal() {
    this.els.buyModal.classList.remove('open');
  }

  setBuyConfirm(icon, title, sub, cost) {
    this.els.buyConfirmIcon.textContent = icon;
    this.els.buyConfirmTitle.textContent = title;
    this.els.buyConfirmSub.textContent = sub;
    this.els.buyConfirmCost.textContent = cost;
  }

  showOverlay(id, ms, particles, particleSystem) {
    return new Promise(resolve => {
      const el = $(id);
      el.classList.add('show');
      if (particles && particleSystem) particleSystem.spawn(true);
      setTimeout(() => { el.classList.remove('show'); resolve(); }, ms);
    });
  }
}

// ─────────────────────────────────────────────
// CLASS: GameState
// Holds all mutable game state.
// ─────────────────────────────────────────────
class GameState {
  constructor(startBalance = 5000, startBet = 10) {
    this.balance = startBalance;
    this.bet = startBet;
    this.spinning = false;
    this.freeSpins = 0;
    this.inFreeSpins = false;
    this.freeSpinTotalWin = 0;
    this.boosted = false;
    this.spinCount = 0;
  }
}

// ─────────────────────────────────────────────
// CLASS: Evaluator
// Evaluates the final grid and marks winning tiles.
// ─────────────────────────────────────────────
class Evaluator {
  constructor(generator) {
    this.generator = generator;
  }

  async evaluate(finals, grid, state, ui, particles) {
    let totalWin = 0, triggered = false, scatters = 0;

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (finals[r][c] === SCATTER) scatters++;

    for (const sym of SYMBOLS) {
      const matches = [];
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (finals[r][c] === sym) matches.push([r, c]);

      if (matches.length >= 8) {
        const winAmt = state.bet * this.generator.multiplier(sym, matches.length);
        totalWin += winAmt;
        matches.forEach(([r, c]) => grid.markWinner(r, c, matches.length));
      }
    }

    if (scatters === 4 && !state.inFreeSpins) {
      state.freeSpins += 10;
      triggered = true;
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (finals[r][c] === SCATTER) grid.markScatter(r, c);
      ui.showWinMessage('🤴 THE PRINCE BLESSES YOU! 10 FREE SPINS! 🤴');
    }

    if (totalWin > 0) {
      grid.setHasWinners(true);
      state.balance += totalWin;
      if (state.inFreeSpins) state.freeSpinTotalWin += totalWin;
      ui.updateBalance(state.balance);
      ui.updateWinDisplay(totalWin);
      const isMega = totalWin >= state.bet * 20;
      const isBigWin = totalWin >= state.bet * 10;
      if (!triggered) {
        if (isBigWin) {
          particles.spawn(true);
          await ui.showBigWinCounting(totalWin, isMega);
        } else {
          ui.showWinMessage(`💰 WIN! $${totalWin.toFixed(0)}`);
          particles.spawn(false);
        }
      } else {
        particles.spawn(isBigWin);
      }
      // Extra idle after big win overlay closes
      if (isBigWin) await delay(300);
    }

    return triggered;
  }
}

// ─────────────────────────────────────────────
// CLASS: BuySpinsModal
// Handles the "Buy Free Spins" modal logic.
// ─────────────────────────────────────────────
class BuySpinsModal {
  constructor(ui, state, game) {
    this.ui = ui;
    this.state = state;
    this.game = game;
    this.modalBet = state.bet; // independent bet for buy modal

    $('buyFsBtn').addEventListener('click', () => this.open());
    $('buyPurchaseBtn').addEventListener('click', () => this.purchase());
    $('buyCancelBtn').addEventListener('click', () => this.close());
    $('buyBetDecBtn').addEventListener('click', () => this.changeBet(-10));
    $('buyBetIncBtn').addEventListener('click', () => this.changeBet(10));
  }

  changeBet(delta) {
    this.modalBet = Math.max(10, Math.min(200, this.modalBet + delta));
    this._updateDisplay();
  }

  _updateDisplay() {
    $('buyBetDisplay').textContent = this.modalBet;
    const cost = this.modalBet * FS_MULT;
    $('buyModalCost').textContent = '$' + cost.toFixed(0);
    $('buyModalFormula').textContent = `100× bet ($${this.modalBet})`;
    const canAfford = this.state.balance >= cost;
    $('buyPurchaseBtn').disabled = !canAfford;
    $('buyModalCost').style.color = canAfford ? '#fff' : '#f66';
  }

  open() {
    if (this.state.spinning) return;
    this.modalBet = this.state.bet; // sync to current bet on open
    this._updateDisplay();
    this.ui.openBuyModal();
  }

  close() {
    this.ui.closeBuyModal();
  }

  async purchase() {
    const cost = this.modalBet * FS_MULT;
    if (this.state.balance < cost) {
      const m = $('buyModal');
      m.style.cssText += 'border-color:#f44;box-shadow:0 0 30px rgba(255,60,60,.4)';
      if (!m.querySelector('.ins-msg')) {
        const d = Object.assign(document.createElement('div'), {
          className: 'ins-msg',
          textContent: '⚠️ INSUFFICIENT BALANCE'
        });
        Object.assign(d.style, { color:'#f66', fontFamily:'Nunito,sans-serif', fontSize:'12px', textAlign:'center', letterSpacing:'2px', marginBottom:'8px', fontWeight:'700' });
        m.querySelector('.buy-modal-footer').before(d);
        setTimeout(() => { d.remove(); m.style.borderColor = ''; m.style.boxShadow = ''; }, 2000);
      }
      return;
    }
    this.close();
    // Apply the modal bet to game state for this purchase
    const savedBet = this.state.bet;
    this.state.bet = this.modalBet;
    this.state.balance -= cost;
    this.ui.updateBalance(this.state.balance);
    this.ui.updateBet(this.state.bet);
    this.state.freeSpins = 10;
    await this.game._runBuyRevealSpin();
    await this.game.startFreeSpins();
    // Restore original bet after free spins
    this.state.bet = savedBet;
    this.ui.updateBet(this.state.bet);
  }
}

// ─────────────────────────────────────────────
// CLASS: LoadingScreen
// Handles the animated loading screen.
// ─────────────────────────────────────────────
class LoadingScreen {
  constructor(onComplete) {
    this.onComplete = onComplete;
  }

  async run() {
    const ct = $('loadStars');
    for (let i = 0; i < 80; i++) {
      const s = Object.assign(document.createElement('div'), { className: 'star' });
      const sz = 1 + Math.random() * 3;
      s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;top:${Math.random()*100}%;animation-duration:${2+Math.random()*3}s;animation-delay:${Math.random()*3}s`;
      ct.appendChild(s);
    }

    const bar = $('loadBar'), pct = $('loadPct'), tip = $('loadTip');
    const tips = ['Ripening the fruits...','Polishing the cherries...','Summoning the Prince...','Squeezing the oranges...','Planting lucky seeds...','Counting the grapes...'];
    let ti = 0;
    const iv = setInterval(() => {
      ti = (ti + 1) % tips.length;
      tip.style.opacity = 0;
      setTimeout(() => { tip.textContent = tips[ti]; tip.style.opacity = ''; }, 300);
    }, 900);

    for (let i = 0; i <= 100; i++) {
      await delay(30 + Math.random() * 20);
      bar.style.width = i + '%';
      pct.textContent = i + '%';
    }
    clearInterval(iv);
    await delay(300);
    $('loadingScreen').classList.add('hidden');
    await delay(800);
    this.onComplete();
  }
}

// ─────────────────────────────────────────────
// CLASS: Booster
// Toggles the 10% scatter chance boost for the next spin.
// ─────────────────────────────────────────────
class Booster {
  constructor(state) {
    this.state = state;
    this.btn = $('boosterBtn');
    this.btn.addEventListener('click', () => this.toggle());
  }

  toggle() {
    if (this.state.spinning || this.state.inFreeSpins) return;
    this.state.boosted = !this.state.boosted;
    if (this.state.boosted) {
      this.state.bet = Math.min(200, this.state.bet + 10);
    } else {
      this.state.bet = Math.max(10, this.state.bet - 10);
    }
    $('betAmount').textContent = this.state.bet;
    this.updateUI();
  }

  updateUI() {
    const active = this.state.boosted;
    this.btn.classList.toggle('active', active);
    $('buyFsBtn').disabled = active;
  }

  setDisabled(disabled) {
    this.btn.disabled = disabled;
  }
}

// Orchestrates the entire game: spin, free spins, evaluation.
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// CLASS: AutoSpin
// Manages auto-spin selection and execution loop.
// ─────────────────────────────────────────────
class AutoSpin {
  constructor(state, ui, game) {
    this.state = state;
    this.ui = ui;
    this.game = game;
    this.remainingSpins = 0;
    this.selectedCount = 0;
    this.running = false;
    this.stopRequested = false;

    $('autoSpinBtn').addEventListener('click', () => this.handleBtnClick());
    $('autoSpinCancelBtn').addEventListener('click', () => this.closeModal());
    $('autoSpinConfirmBtn').addEventListener('click', () => this.start());
    $('autoSpinStopBtn').addEventListener('click', () => this.stop());

    document.querySelectorAll('.auto-pkg').forEach(pkg => {
      pkg.addEventListener('click', () => this.selectPackage(parseInt(pkg.dataset.count)));
    });
  }

  handleBtnClick() {
    if (this.running) this.stop();
    else this.openModal();
  }

  openModal() {
    if (this.state.spinning || this.state.inFreeSpins || this.running) return;
    this.selectedCount = 0;
    $('autoSpinConfirmBtn').disabled = true;
    document.querySelectorAll('.auto-pkg').forEach(p => p.classList.remove('selected'));
    [20, 30, 50].forEach(n => {
      $('autoCost' + n).textContent = '$' + (this.state.bet * n).toFixed(0) + ' total';
    });
    $('autoSpinModal').classList.add('open');
  }

  closeModal() {
    $('autoSpinModal').classList.remove('open');
  }

  selectPackage(count) {
    this.selectedCount = count;
    document.querySelectorAll('.auto-pkg').forEach(p =>
      p.classList.toggle('selected', parseInt(p.dataset.count) === count)
    );
    $('autoSpinConfirmBtn').disabled = this.state.balance < this.state.bet;
  }

  async start() {
    if (!this.selectedCount) return;
    this.closeModal();
    this.remainingSpins = this.selectedCount;
    this.running = true;
    this.stopRequested = false;

    $('autoSpinHUD').classList.add('visible');
    $('autoSpinBtn').classList.add('active');
    $('autoSpinBtn').textContent = '■ STOP AUTO';

    while (this.remainingSpins > 0 && !this.stopRequested) {
      if (this.state.balance < this.state.bet) {
        this.ui.showWinMessage('💸 NO BALANCE — AUTO SPIN STOPPED');
        break;
      }
      $('autoSpinCount').textContent = this.remainingSpins;
      await this.game.spin();
      while (this.state.inFreeSpins) await delay(200);
      this.remainingSpins--;
      await delay(300);
    }

    this.finish();
  }

  stop() {
    this.stopRequested = true;
  }

  finish() {
    this.running = false;
    this.remainingSpins = 0;
    $('autoSpinHUD').classList.remove('visible');
    $('autoSpinBtn').classList.remove('active');
    $('autoSpinBtn').textContent = '🔁 AUTO';
  }

  setDisabled(disabled) {
    $('autoSpinBtn').disabled = disabled;
  }
}

// ─────────────────────────────────────────────
// CLASS: BetSettingsModal
// Preset bet selector modal triggered by clicking bet display
// ─────────────────────────────────────────────
class BetSettingsModal {
  constructor(state, ui) {
    this.state = state;
    this.ui = ui;
    this.selected = state.bet;
    this.presets = [10, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200];

    this._buildGrid();
    $('betSettingsClose').addEventListener('click', () => this.close());
    $('betSettingsAccept').addEventListener('click', () => this.accept());
    $('betSettingsModal').addEventListener('click', e => {
      if (e.target === $('betSettingsModal')) this.close();
    });
  }

  _buildGrid() {
    const grid = $('betSettingsGrid');
    grid.innerHTML = '';
    this.presets.forEach(val => {
      const btn = document.createElement('button');
      btn.className = 'bet-preset-btn' + (val === this.selected ? ' selected' : '');
      btn.textContent = val.toFixed(2);
      btn.addEventListener('click', () => {
        this.selected = val;
        grid.querySelectorAll('.bet-preset-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._updateNote();
      });
      grid.appendChild(btn);
    });
    this._updateNote();
  }

  _updateNote() {
    const maxWin = this.selected * 500;
    $('betSettingsNote').textContent = `The maximum win is ${maxWin.toLocaleString()}.00$ for a bet of ${this.selected.toFixed(2)}$.`;
  }

  open() {
    if (this.state.spinning || this.state.inFreeSpins) return;
    this.selected = this.state.bet;
    this._buildGrid();
    $('betSettingsModal').classList.add('open');
  }

  close() {
    $('betSettingsModal').classList.remove('open');
  }

  accept() {
    this.state.bet = this.selected;
    this.ui.updateBet(this.state.bet);
    this.close();
  }
}

// ─────────────────────────────────────────────
class Game {
  constructor() {
    this.generator = new SymbolGenerator(SYMBOLS, WEIGHTS, SCATTER);
    this.state = new GameState();
    this.ui = new UIManager();
    this.grid = new Grid($('grid'), this.generator);
    this.particles = new ParticleSystem($('particles'));
    this.evaluator = new Evaluator(this.generator);
    this.booster = new Booster(this.state);
    this.autoSpin = new AutoSpin(this.state, this.ui, this);
    this.buyModal = new BuySpinsModal(this.ui, this.state, this);
    this.betSettings = new BetSettingsModal(this.state, this.ui);
    this._bindControls();
  }

  _bindControls() {
    $('spinBtn').addEventListener('click', () => this.spin());
    $('betDecBtn').addEventListener('click', () => this.changeBet(-10));
    $('betIncBtn').addEventListener('click', () => this.changeBet(10));
    $('betDisplay').addEventListener('click', () => this.betSettings.open());
    $('paytableOpenBtn').addEventListener('click', () => $('paytable').classList.add('open'));
    $('paytableCloseBtn').addEventListener('click', () => $('paytable').classList.remove('open'));
    $('playBtn').addEventListener('click', () => this.startGame());
  }

  startGame() {
    $('mainMenu').classList.add('hidden');
    setTimeout(() => {
      $('gameRoot').classList.remove('hidden');
      requestAnimationFrame(() => requestAnimationFrame(() => this.grid.build()));
    }, 600);
  }

  changeBet(delta) {
    if (this.state.spinning || this.state.inFreeSpins) return;
    this.state.bet = Math.max(10, Math.min(200, this.state.bet + delta));
    this.ui.updateBet(this.state.bet);
    if ($('buyModal').classList.contains('open')) {
      this.ui.updateBuyModal(this.state.bet, FS_MULT, this.state.balance);
    }
  }

  // Generates finals with exactly 4 scatters placed at random positions
  _generateFinalsWithFourScatters() {
    const finals = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => {
        let sym;
        do { sym = this.generator.random(false); } while (sym === SCATTER);
        return sym;
      })
    );
    // Pick 4 unique random positions for the scatters
    const positions = [];
    while (positions.length < 4) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      if (!positions.some(([pr, pc]) => pr === r && pc === c)) {
        positions.push([r, c]);
        finals[r][c] = SCATTER;
      }
    }
    return finals;
  }

  async _runBuyRevealSpin() {
    this.ui.updateWinDisplay(0);
    this.grid.clearWins();
    const finals = this._generateFinalsWithFourScatters();
    await this.grid.spin(finals, 80, 900, false);
    await delay(100);
    // Mark all 4 scatters
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (finals[r][c] === SCATTER) this.grid.markScatter(r, c);
    this.particles.spawn(true);
    await delay(1200);
  }

  _generateFinals(boosted = false) {
    const finals = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => this.generator.random(boosted))
    );
    // Count scatters and replace any 4th+ with a regular symbol
    let scatterCount = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (finals[r][c] === SCATTER) {
          scatterCount++;
          if (scatterCount >= 4) {
            let sym;
            do { sym = this.generator.random(false); } while (sym === SCATTER);
            finals[r][c] = sym;
          }
        }
      }
    }
    return finals;
  }

  async _runSpin(isFree = false) {
    this.ui.updateWinDisplay(0);
    this.grid.clearWins();
    const boosted = !isFree && this.state.boosted;
    const finals = this._generateFinals(boosted);
    const BASE = isFree ? 650 : 900;
    await this.grid.spin(finals, isFree ? 55 : 80, BASE, isFree);
    await delay(isFree ? 80 : 100);
    return await this.evaluator.evaluate(finals, this.grid, this.state, this.ui, this.particles);
  }

  async spin() {
    const { state, ui } = this;
    if (state.spinning || state.balance < state.bet) return;
    state.spinning = true;
    state.balance -= state.bet;
    ui.updateBalance(state.balance);
    ui.setSpinButton(false);

    // Increment spin counter and check every-80-spins bonus
    state.spinCount++;
    let milestoneTriggered = false;
    if (state.spinCount % 80 === 0 && !state.inFreeSpins) {
      state.freeSpins += 10;
      milestoneTriggered = true;
    }

    if (milestoneTriggered) {
      // Skip normal spin — go straight to 4-scatter reveal like buying free spins
      this.ui.updateWinDisplay(0);
      this.grid.clearWins();
      state.spinning = false;
      await this._runBuyRevealSpin();
      await this.startFreeSpins();
      return;
    }

    const triggered = await this._runSpin(false);
    state.spinning = false;
    if (triggered) {
      await this.startFreeSpins();
    }
    else {
      if (state.balance < state.bet) ui.setSpinButton(false, 'NO FUNDS');
      else ui.setSpinButton(true, 'SPIN');
    }
  }

  async startFreeSpins() {
    const { state, ui } = this;
    state.inFreeSpins = true;
    state.freeSpinTotalWin = 0;
    await ui.showOverlay('fsIntroOverlay', 3200, true, this.particles);
    document.body.classList.add('freespin-mode');
    ui.showFSHUD(true);
    while (state.freeSpins > 0) {
      state.freeSpins--;
      ui.setFSCount(state.freeSpins);
      await this._runSpin(true);
      await delay(600);
    }
    document.body.classList.remove('freespin-mode');
    ui.showFSHUD(false);
    ui.setFSSummaryWin(state.freeSpinTotalWin);
    await ui.showOverlay('fsSummaryOverlay', 3000, true, this.particles);
    state.inFreeSpins = false;
    if (state.balance < state.bet) ui.setSpinButton(false, 'NO FUNDS');
    else ui.setSpinButton(true, 'SPIN');
    ui.updateBalance(state.balance);
  }
}

// ─────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────
// Spawn floating fruit leaves background
(function spawnLeaves(){
  const ct = $('leavesContainer');
  const fruits = ['🍒','🍋','🍇','🍉','🍊','🍓','🍑','🍍','🌿','🍃'];
  for(let i = 0; i < 22; i++){
    const el = document.createElement('div');
    el.className = 'leaf-bg';
    el.textContent = fruits[Math.floor(Math.random()*fruits.length)];
    const dur = 18 + Math.random() * 20;
    el.style.cssText = `left:${Math.random()*100}%;bottom:-60px;animation-duration:${dur}s;animation-delay:-${Math.random()*dur}s;font-size:${14+Math.random()*22}px;opacity:${0.04+Math.random()*0.07};`;
    ct.appendChild(el);
  }
})();
const game = new Game();
const loader = new LoadingScreen(() => $('mainMenu').classList.remove('hidden'));
loader.run();
