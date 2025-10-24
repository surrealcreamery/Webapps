import { createMachine, assign, log, fromCallback } from 'xstate';
import { v4 as uuidv4 } from 'uuid';

const createNewPhase = () => ({
  uid: uuidv4(),
  cadence: 'MONTHLY',
  periods: 1,
  includePeriods: false,
  pricing: {
    type: 'STATIC',
    price_money: { amount: 0, currency: 'USD' }
  },
});

export const planMachine = createMachine({
  id: 'planWizard',
  context: ({ input }) => ({
    parentPlanId: input?.parentPlanId,
    onAdd: input?.onAdd,
    planName: '',
    phases: [createNewPhase()],
    error: null,
  }),
  initial: 'editing',
  states: {
    editing: {
      entry: log("Machine: Entered 'editing' state.", 'planWizard'),
      on: {
        UPDATE_NAME: {
          actions: assign({ planName: ({ event }) => event.value }),
        },
        ADD_PHASE: {
          actions: assign({ phases: ({ context }) => [...context.phases, createNewPhase()] }),
        },
        UPDATE_PHASE: {
          actions: assign({
            phases: ({ context, event }) =>
              context.phases.map(p => (p.uid === event.uid ? { ...p, ...event.data } : p)),
          }),
        },
        // ✅ START: This handler was missing and has been added back.
        REMOVE_PHASE: {
          actions: assign({
            phases: ({ context, event }) => context.phases.filter(p => p.uid !== event.uid)
          }),
        },
        // ✅ END: Fix
        SUBMIT: {
          guard: ({ context }) => context.planName.trim() !== '' && context.phases.length > 0,
          target: 'submitting',
        },
        CANCEL: 'cancelled',
      },
    },
    submitting: {
      entry: log("Machine: Entered 'submitting', invoking actor.", "planWizard"),
      invoke: {
        id: 'submitPlan',
        src: fromCallback(({ input, sendBack }) => {
            if (typeof input.onAdd !== 'function') {
                sendBack({ type: 'SUBMISSION.FAILURE', error: new Error('onAdd is not a function.') });
                return;
            }
            input.onAdd(input.payload)
                .then(() => sendBack({ type: 'SUBMISSION.SUCCESS' }))
                .catch((err) => sendBack({ type: 'SUBMISSION.FAILURE', error: err }));
        }),
        input: ({ context }) => {
          const payload = {
            idempotency_key: uuidv4(),
            object: {
              type: "SUBSCRIPTION_PLAN_VARIATION",
              id: "#1",
              subscription_plan_variation_data: {
                name: context.planName,
                subscription_plan_id: context.parentPlanId,
                phases: context.phases.map((phase, index) => {
                  const phaseData = {
                    cadence: phase.cadence,
                    ordinal: index,
                    pricing: {
                      type: phase.pricing.type,
                      price_money: {
                        amount: phase.pricing.price_money.amount ?? 0,
                        currency: phase.pricing.price_money.currency,
                      }
                    }
                  };
                  if (phase.includePeriods) {
                    phaseData.periods = phase.periods;
                  }
                  return phaseData;
                }),
              }
            }
          };
          return { payload, onAdd: context.onAdd };
        },
      },
      on: {
        'SUBMISSION.SUCCESS': 'success',
        'SUBMISSION.FAILURE': {
          target: 'editing',
          actions: assign({ error: ({ event }) => event.error || 'An unknown error occurred.' }),
        }
      }
    },
    success: { type: 'final' },
    cancelled: { type: 'final' },
  },
});