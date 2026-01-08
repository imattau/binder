import { SimplePool } from 'nostr-tools';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol'
];

const pool = new SimplePool();

const config = {
  iterations: Number(process.env.LOAD_ITERS ?? 6),
  concurrency: Number(process.env.LOAD_CONC ?? 4),
  pauseMs: Number(process.env.LOAD_PAUSE ?? 500)
};

const filter = {
  kinds: [30003],
  limit: 6
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryOne(iteration, index) {
  const start = Date.now();
  try {
    const events = await pool.query(RELAYS, filter);
    const duration = Date.now() - start;
    console.log(`iteration ${iteration}/${index} fetched ${events.length} events in ${duration}ms`);
    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`iteration ${iteration}/${index} failed after ${duration}ms`, error);
    return { success: false, duration, error };
  }
}

async function runLoadTest() {
  console.log('starting relay load test', config);
  const results = [];
  for (let iteration = 1; iteration <= config.iterations; iteration++) {
    const batch = Array.from({ length: config.concurrency }, (_, index) =>
      queryOne(iteration, index + 1)
    );
    const settled = await Promise.all(batch);
    results.push(...settled);
    if (iteration < config.iterations && config.pauseMs > 0) {
      await wait(config.pauseMs);
    }
  }
  const success = results.filter(r => r.success).length;
  const fail = results.length - success;
  const avg = Math.round(results.reduce((sum, r) => sum + (r.duration ?? 0), 0) / results.length);
  console.log(`load test completed — ${success} succeeded, ${fail} failed, avg ${avg}ms`); // maybe include warns
  pool.close();
}

runLoadTest().catch(error => {
  console.error('load test uncaught', error);
  pool.close();
});
