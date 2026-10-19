# %% [markdown]
# # Simulated factory sensors → Supabase
# This notebook pretends to be the energy meters on your machines. For every operation of a route it sends **energy readings** to your
# database; the **dashboard** and the **digital twin** then show them as live data (reload the dashboard; the twin refreshes itself every 30 seconds).
#
# **Before you start (once):**
# 1. In Supabase run `supabase/7_sensor_ingest.sql`.
# 2. In the Supabase SQL editor run `select create_ingest_token('colab-simulator');` and copy the long text it returns (shown only once).
# 3. In Colab, open the key icon (**Secrets**) in the left bar and add three secrets, switching **Notebook access** on for each:
#    `SUPABASE_URL` (your Project URL), `SUPABASE_ANON_KEY` (the public key) and `DEVICE_TOKEN` (the text from step 2).
#
# The device token can only add readings; it cannot read or change anything else. Never paste it into GitHub.

# %%
import os, time, random, getpass, datetime as dt
import requests

def secret(name, prompt, hidden=False):
    """Colab secret if there is one, else an environment variable, else ask."""
    try:
        from google.colab import userdata
        return userdata.get(name)
    except Exception:
        return os.environ.get(name) or (getpass.getpass(prompt) if hidden else input(prompt))

SUPABASE_URL = secret('SUPABASE_URL', 'Supabase Project URL: ').strip().rstrip('/')
ANON_KEY = secret('SUPABASE_ANON_KEY', 'Supabase public key (anon / publishable): ', True).strip()
DEVICE_TOKEN = secret('DEVICE_TOKEN', 'Device token: ', True).strip()

HEAD = {'apikey': ANON_KEY, 'Content-Type': 'application/json'}
if ANON_KEY.startswith('eyJ'):
    HEAD['Authorization'] = 'Bearer ' + ANON_KEY

def get(view, **params):
    r = requests.get(f'{SUPABASE_URL}/rest/v1/{view}', headers=HEAD, params={'select': '*', **params}, timeout=30)
    r.raise_for_status()
    return r.json()

def send_reading(scenario_id, operation_id, sensor_code, kwh, state='running', run_label=None):
    """One reading -> the database (function ingest_reading). Returns the stored reading id."""
    body = {'p_token': DEVICE_TOKEN, 'p_scenario_id': scenario_id, 'p_route_operation_id': operation_id, 'p_sensor_code': sensor_code,
            'p_kwh': round(kwh, 4), 'p_machine_state': state, 'p_run_label': run_label}
    r = requests.post(f'{SUPABASE_URL}/rest/v1/rpc/ingest_reading', headers=HEAD, json=body, timeout=30)
    if r.status_code >= 400:
        raise RuntimeError(f'{r.status_code}: {r.text}')
    return r.json()

# %%
# ---- settings: change these and run again ----------------------------------------------------------------------------
SCENARIO_ID = 1                 # which route to simulate (1 = vacuum infusion in the example data; see v_dash_scenarios)
RUNS = 1                        # how many production runs (one part each) to simulate
INTERVALS_PER_OP = 6            # readings per operation (each one is the kWh used in that slice of the operation)
SECONDS_PER_SIM_HOUR = 0.4      # speed: real seconds per simulated hour (0 = as fast as possible)
NOISE = 0.05                    # random variation of every reading (0.05 = about 5 %)
DEFAULT_BIAS = 0.10             # machines use this much more energy than the design value ...
BIAS = {'PPSS oven': 0.39, 'Spray booth': 0.30, 'CNC router': 0.25,      # ... except these (the oven hot-running example)
        'Vacuum pump': 0.21, 'Adhesive dispenser': 0.60}
SENSOR_CODES = {'Vacuum pump': 'MTR-VAC-001', 'PPSS oven': 'MTR-OVN-PPSS', 'CNC router': 'MTR-CNC-001',
                'Adhesive dispenser': 'MTR-ADH-001', 'Spray booth': 'MTR-SPRAY-001'}     # others become SIM-<machine>

# %%
def simulate_run(scenario_id):
    label = 'SIM-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S')
    ops = get('v_dash_operations', scenario_id=f'eq.{scenario_id}', order='op_no')
    if not ops:
        raise SystemExit(f'No operations for scenario {scenario_id}: check SCENARIO_ID.')
    print(f'Run {label}: scenario {scenario_id}, {len(ops)} operations')
    print(f"{'op':>3}  {'machine':<20}{'sensor':<16}{'design kWh':>11}{'sent kWh':>10}{'vs design':>10}")
    totals = {}
    for op in ops:
        design = op['hours'] * op['kw'] * op['utilisation']
        machine = op['machine_name'] or f"op{op['op_no']}"
        sensor = SENSOR_CODES.get(machine, 'SIM-' + machine.replace(' ', '-').upper())
        target = design * (1 + BIAS.get(machine, DEFAULT_BIAS))
        sent = 0.0
        for i in range(INTERVALS_PER_OP):
            kwh = max(0.0, target / INTERVALS_PER_OP * random.gauss(1, NOISE))
            send_reading(scenario_id, op['operation_id'], sensor, kwh, 'running', label)
            sent += kwh
            time.sleep(op['hours'] / INTERVALS_PER_OP * SECONDS_PER_SIM_HOUR)
        totals[op['op_no']] = sent
        pct = (sent / design - 1) * 100 if design else 0
        print(f"{op['op_no']:>3}  {machine:<20}{sensor:<16}{design:>11.3f}{sent:>10.3f}{pct:>9.1f}%")
    return label, totals

for n in range(RUNS):
    label, totals = simulate_run(SCENARIO_ID)
print('Done. Reload the dashboard; the twin picks it up within 30 seconds.')

# %% [markdown]
# ## Check what the database now holds
# This reads the public views, exactly what the website reads.

# %%
live = get('v_dash_live', scenario_id=f'eq.{SCENARIO_ID}')
print(f'{len(live)} readings in the latest run ({live[0]["run_label"] if live else "-"})')
by_op = {}
for r in live:
    by_op[r['operation_id']] = by_op.get(r['operation_id'], 0) + r['kwh']
for op_id, kwh in sorted(by_op.items()):
    print(f'  operation {op_id}: {kwh:.3f} kWh')
s = get('v_scenario_summary', scenario_id=f'eq.{SCENARIO_ID}')[0]
print(f"\n{s['scenario_name']}: design {s['design_total_kgco2e']:.3f} kg CO2e, live {s['live_total_kgco2e']:.3f} kg CO2e, extra energy {s['extra_kwh']:.2f} kWh")
