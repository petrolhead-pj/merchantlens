import { submitCheckout } from "./case-feed.js";
import { observeCheckout } from "./checkout-observer.js";

const fixtures = [
  { sport: "Football", phase: "Live", time: "63′", home: "Harbour City", away: "Northbridge", prices: ["1.85", "3.40", "4.10"] },
  { sport: "Football", phase: "Upcoming", time: "19:45", home: "Westport AFC", away: "East Vale", prices: ["2.15", "3.20", "3.15"] },
  { sport: "Basketball", phase: "Live", time: "Q3", home: "Metro Owls", away: "Coast Falcons", prices: ["1.58", "2.35"] },
  { sport: "Cricket", phase: "Upcoming", time: "20:00", home: "River Royals", away: "Summit Kings", prices: ["1.91", "1.91"] },
];
const marketList = document.querySelector("#market-list");
const selection = document.querySelector("#selection");
const clearPick = document.querySelector("#clear-pick");
const sportButtons = [...document.querySelectorAll("[data-sport]")];
const phaseButtons = [...document.querySelectorAll("[data-phase]")];
let sport = "All";
let phase = "All";
let pick = null;

function renderMarkets() {
  const rows = fixtures.flatMap((fixture, index) => {
    if ((sport !== "All" && fixture.sport !== sport) || (phase !== "All" && fixture.phase !== phase)) return [];
    const labels = fixture.prices.length === 3 ? ["Home", "Draw", "Away"] : ["Home", "Away"];
    return `<article class="fixture">
      <p class="fixture-meta"><span class="${fixture.phase.toLowerCase()}">${fixture.phase}</span> · ${fixture.time} · ${fixture.sport}</p>
      <h3>${fixture.home} vs ${fixture.away}</h3>
      <div class="market-grid">${fixture.prices.map((price, option) => `
        <button type="button" data-fixture="${index}" data-option="${option}" aria-pressed="${pick?.fixture === index && pick?.option === option}">
          <span>${labels[option]}</span><strong class="market-price">${price}</strong>
        </button>`).join("")}</div>
    </article>`;
  });
  marketList.innerHTML = rows.join("") || "<p>No demo fixtures match these filters.</p>";
}

function setFilters(nextSport, nextPhase) {
  sport = nextSport;
  phase = nextPhase;
  sportButtons.forEach(button => button.setAttribute("aria-pressed", button.dataset.sport === sport));
  phaseButtons.forEach(button => button.setAttribute("aria-pressed", button.dataset.phase === phase));
  renderMarkets();
}

function showPick(nextPick) {
  pick = nextPick;
  if (pick) {
    const fixture = fixtures[pick.fixture];
    const team = pick.option === 0 ? fixture.home : pick.option === fixture.prices.length - 1 ? fixture.away : "Draw";
    selection.textContent = team + " · " + fixture.prices[pick.option];
  } else {
    selection.textContent = "Select odds to preview a pick.";
  }
  selection.classList.toggle("pick-name", Boolean(pick));
  clearPick.hidden = !pick;
  document.querySelector("#slip-count").textContent = pick ? "1" : "0";
  marketList.querySelectorAll("[data-fixture]").forEach(button => {
    button.setAttribute("aria-pressed", pick?.fixture === Number(button.dataset.fixture) && pick?.option === Number(button.dataset.option));
  });
}

sportButtons.forEach(button => button.addEventListener("click", () => setFilters(button.dataset.sport, phase)));
phaseButtons.forEach(button => button.addEventListener("click", () => setFilters(sport, button.dataset.phase)));
document.querySelector("#featured-markets").addEventListener("click", () => setFilters("Football", "All"));
marketList.addEventListener("click", event => {
  const market = event.target.closest("[data-fixture]");
  if (market) showPick({ fixture: Number(market.dataset.fixture), option: Number(market.dataset.option) });
});
clearPick.addEventListener("click", () => showPick(null));
renderMarkets();

const button = document.querySelector("#deposit");
const status = document.querySelector("#status");
const ref = crypto.randomUUID();
const payment = crypto.randomUUID();
button.dataset.ref = ref;
button.dataset.payment = payment;
document.querySelector("#investigation").href = "./index.html?case=" + ref;

let click;
observeCheckout(document.querySelector("main"), observation => { click = observation; });
button.addEventListener("click", async () => {
  if (!click) return;
  button.disabled = true;
  status.textContent = "Sending simulated payment…";
  try {
    await submitCheckout({ scenario: "Wallet top-up", delay: 5, ref, payment, click }, () => {
      document.querySelector("#balance").textContent = "₹500";
      status.textContent = "Payment confirmed. Sending wallet evidence in 5 seconds.";
    });
    status.textContent = "Wallet evidence sent. Open MerchantLens to see the case.";
  } catch {
    status.textContent = "The event feed could not complete this checkout. Reload to start a fresh payment.";
  }
});
