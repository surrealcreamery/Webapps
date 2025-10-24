import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuth } from 'firebase/auth';

// ——— Firebase-authenticated fetch helper —————————————————————————————
async function authFetch(url, options = {}) {
  const auth = getAuth();
  const user = auth.currentUser;
  let idToken = null;
  if (user) {
    idToken = await user.getIdToken();
  }
  const headers = {
    ...options.headers,
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
  };
  // Assuming fetchWithAuth is the intended primary fetcher,
  // but this function seems to call it, creating a potential loop.
  // For clarity, I'm assuming the intent was to have a base fetcher.
  // Let's directly use the logic from your defined `fetchWithAuth` below.
  const response = await fetch(url, { ...options, headers });
  const responseBodyText = await response.text();
  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`);
    error.status = response.status;
    error.info = responseBodyText; 
    throw error;
  }
  try {
    return JSON.parse(responseBodyText);
  } catch (e) {
    return responseBodyText; 
  }
}

/**
 * Standard fetch wrapper that includes the Firebase ID token and correctly handles responses.
 */
export default async function fetchWithAuth(url, options = {}) {
  const auth = getAuth();
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  // 1. Read the response body ONLY ONCE and save it as text.
  const responseBodyText = await response.text();

  // 2. Check if the request was successful.
  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`);
    error.status = response.status;
    // Attach the body we already read to the error for debugging.
    error.info = responseBodyText; 
    throw error;
  }

  // 3. If it was successful, try to parse the text as JSON.
  try {
    const data = JSON.parse(responseBodyText);
    return data;
  } catch (e) {
    // If parsing fails, the response was not JSON.
    console.warn("Response was not valid JSON, returning as raw text.");
    return responseBodyText; 
  }
}

// CORRECTED: Changed from 'export default' to a named 'export'
export async function fetchWithToken(url, options = {}) {
  const auth = getAuth();
  // Force-refresh the token to avoid stale/expired tokens
  const token = auth.currentUser 
    ? await auth.currentUser.getIdToken(/* forceRefresh */ true) 
    : null;

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    // capture HTTP error code
    const errorBody = await res.text();
    const error = new Error(`Error ${res.status}: ${errorBody}`);
    error.status = res.status;
    throw error;
  }
  // Handle cases where the response might be empty
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return text; // Return as text if not valid JSON
  }
}


// ——— Endpoint URLs —————————————————————————————————
// ACCESS
const USER_LIST_URL            = 'https://hook.us2.make.com/ln9r21h0yfvuwo9verwmr6ouqkc0lbvd';
const USER_PERMS_URL           = 'https://hook.us2.make.com/ehmthsxenbv3jds6d825bhft3kvhuxnp';
const UPDATE_PERMS_URL         = 'https://hook.us2.make.com/dec7onj9ddctcdd9b4l1s40gi7iq8vv1';
const CREATE_USER_URL          = 'https://hook.us2.make.com/st1wgm7wobfxwgw6cd3yzw9j193e7wcl';

// PRICING MODELS
const PRICING_MODELS_URL       = 'https://hook.us2.make.com/t6lj7fteskrel9x9ztcig43xxwf62xqc';

// LOCATIONS
const LOCATIONS_URL            = 'https://hook.us2.make.com/bulds2yd1029oxj7pmdal67xe7ajy2j7';

// SUBSCRIPTIONS
const SUBSCRIPTIONS_URL        = 'https://hook.us2.make.com/eoayonr2jp1muxw67opn9gqut42jpgpl';
const SUBSCRIPTIONS_DETAIL_URL = 'https://hook.us2.make.com/d1s01of9wd9j8frzfg5tbl7ehutontef';
const CREATE_SUBSCRIPTION_URL  = 'https://hook.us2.make.com/eqnqw1hfbpfun4f9fgp19j2xg6lxw7oj';
const UPDATE_SUBSCRIPTION_URL  = 'https://hook.us2.make.com/79nuinousgc7ue51yumcksh8yvl6otba';
const BENEFITS_URL             = 'https://hook.us2.make.com/eftwd4vli8bs8matfpk14lxdbp2e82wr';
const CREATE_BENEFIT_URL       = 'https://hook.us2.make.com/vhqvm9pfd7mnqvm2mogwea64jfw4vh92';
const UPDATE_BENEFIT_URL       = 'https://hook.us2.make.com/jqzj4jpq9rlhmaf5yiruy43xkub5jnul';
const DELETE_BENEFIT_URL       = 'https://hook.us2.make.com/m331kleqzaiwyeqpkyw59s4f2ccza88y';
const ENTITLEMENTS_URL         = 'https://hook.us2.make.com/cri381cb8ljplfbf83gdpfp62aiywose';
const REDEEM_ENTITLEMENT_URL   = 'https://hook.us2.make.com/e23wquhkionmf64ueu0bpxqx5iqg28b8';



// PLANS
const PLANS_URL                = 'https://hook.us2.make.com/p2tenjgj1dr3a3jurzkclf1la6eifeoa';
const CREATE_PLAN_URL          = 'https://hook.us2.make.com/tw92wjbcchbhx939ck5nhj26pfclnn59';
const UPDATE_PLAN_URL          = 'https://hook.us2.make.com/4767mfvmpk3ro4jxqyx61cbhyzkyrnrw';
const DELETE_PLAN_URL          = 'https://hook.us2.make.com/sx71985eybb2gvondc7rql9pocl61m7g';
const CREATE_SQUARE_PLAN_VARIATION_URL = 'https://hook.us2.make.com/12j7p9b1x2tmzimusiccth8midtauu37';
const CREATE_SQUARE_PLAN_URL = 'https://hook.us2.make.com/aqycnphq7bfeh278qughqhoio7qbwryx';
const DEPRECATE_SQUARE_PLAN_VARIATION_URL = 'https://hook.us2.make.com/7te36hnc2kwjfr93ummjdsjfiakql798';
const RETRIEVE_DEPRECATED_SQUARE_PLAN_VARIATION_URL = 'https://hook.us2.make.com/bnyimy1ayx06wzgdjokwdpj43o9vvjma';


// SUBSCRIBERS
const SUBSCRIBERS_URL          = 'https://hook.us2.make.com/icnv18npftxwzjjcus6oqdpuem9d9r1t';
const SQUARE_PLANS_URL         = 'https://hook.us2.make.com/thw5ui575mn2qhpbwp88ql5433cuq4lf';



// DEVICE MANAGEMENT
const LIST_DEVICES_URL         = 'https://hook.us2.make.com/lrvml8heavqvvwvkoqho4gr3jw9n4twk';


// REPORTS
const LIST_DAILY_REVENUE_BY_CHANNEL_URL = 'https://hook.us2.make.com/jr3g4yxl4uyw4pbbje3k5aua47ykkr3p';
const RETRIEVE_NET_SALES_URL   = 'https://hook.us2.make.com/q0efpsschb7tpduisor6rxsftue7pcu1';
const RETRIEVE_LABOR_URL       = 'https://hook.us2.make.com/ajcqdsqvh92w7kg9eso4gughj24bundi';
const RETRIEVE_ORDERS_BY_DAY_URL = 'https://hook.us2.make.com/svfyr52iragxjt6njhkg1jxl26x98wxk';
const RETRIEVE_TEAM_MEMBERS_URL = 'https://hook.us2.make.com/asscir41bwk5pyh9dop7evgj3x7br8zt';
const TRIAGE_UPLOADED_CSV_URL = 'https://hook.us2.make.com/tuok8d2x9cip5uupcyxwryi1unndc9ih';



const VERIFY_UUID_URL          = 'https://hook.us2.make.com/lnnijsmluypvvzwj3ag60g5zi99fbx2r';

// ——— Raw Fetchers for Prefetching & Mutations ————————————————————————————————
export const fetchDailyRevenue = () =>
  authFetch(LIST_DAILY_REVENUE_BY_CHANNEL_URL).then(data => Array.isArray(data) ? data : []);

export const fetchPlans = () =>
  authFetch(PLANS_URL).then(data => Array.isArray(data) ? data : []);

export const fetchSquarePlans = () =>
  fetchWithToken(SQUARE_PLANS_URL).then(data => Array.isArray(data) ? data : []);

export const fetchDeprecatedSquarePlans = () =>
  fetchWithToken(RETRIEVE_DEPRECATED_SQUARE_PLAN_VARIATION_URL).then(data => Array.isArray(data) ? data : []);

export const fetchLocations = () =>
  authFetch(LOCATIONS_URL).then(data => Array.isArray(data) ? data : []);

export const fetchPricingModels = () =>
  authFetch(PRICING_MODELS_URL).then(data => Array.isArray(data) ? data : []);

export const fetchBenefits = () =>
  authFetch(BENEFITS_URL).then(data => Array.isArray(data) ? data : []);

export const fetchSubscriptions = () =>
  authFetch(SUBSCRIPTIONS_URL).then(data => Array.isArray(data) ? data : []);

export const fetchSubscriptionDetail = (id) =>
  authFetch(`${SUBSCRIPTIONS_DETAIL_URL}?id=${encodeURIComponent(id)}`)
    .then(data => data || {});

export const fetchEntitlements = () =>
  authFetch(ENTITLEMENTS_URL)
    .then(data => Array.isArray(data) ? data : [])
    .catch(() => []);

export const fetchSubscribers = () =>
  authFetch(SUBSCRIBERS_URL).then(data => Array.isArray(data) ? data : []);
  
export const fetchDevices = () => {
  console.log('[AdminDataContext] fetchDevices executing...');
  return authFetch(LIST_DEVICES_URL).then(data => Array.isArray(data) ? data : []);
}

export const fetchTeamMembers = () =>
  authFetch(RETRIEVE_TEAM_MEMBERS_URL).then(data => Array.isArray(data) ? data : []);

export const createUser = (payload) =>
  authFetch(CREATE_USER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const createSubscription = (payload) =>
  authFetch(CREATE_SUBSCRIPTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const updateSubscription = (payload) =>
  authFetch(UPDATE_SUBSCRIPTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const createBenefit = (payload) =>
  authFetch(CREATE_BENEFIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const updateBenefit = (payload) =>
  authFetch(UPDATE_BENEFIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const deleteBenefit = (id) =>
  authFetch(DELETE_BENEFIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });

export const redeemEntitlement = (entitlementId) =>
  authFetch(REDEEM_ENTITLEMENT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: entitlementId }),
  });

export const verifyDevice = (payload) =>
  authFetch(VERIFY_UUID_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const retrieveNetSales = (payload) =>
  authFetch(RETRIEVE_NET_SALES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const retrieveLabor = (payload) =>
  authFetch(RETRIEVE_LABOR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const retrieveOrdersByDay = (payload) =>
  authFetch(RETRIEVE_ORDERS_BY_DAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const triageUploadedCsv = (payload) =>
  authFetch(TRIAGE_UPLOADED_CSV_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const createSquarePlan = (payload) =>
  fetchWithToken(CREATE_SQUARE_PLAN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
export const createSquarePlanVariation = (payload) =>
  fetchWithToken(CREATE_SQUARE_PLAN_VARIATION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const deprecateSquarePlanVariation = (payload) =>
  fetchWithToken(DEPRECATE_SQUARE_PLAN_VARIATION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

// ——— React-Query Hooks —————————————————————————————————
export function useDailyRevenue() {
  return useQuery({
    queryKey: ['admin', 'dailyRevenue'],
    queryFn: fetchDailyRevenue,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const data = await authFetch(USER_LIST_URL, { method: 'POST' });
      const arr = Array.isArray(data) ? data : data.users || [];
      return arr.map(u => ({
        email: u.email || u.Email || u.emailAddress || 'unknown@example.com'
      }));
    },
    staleTime:           Infinity,
    cacheTime:           Infinity,
    refetchOnMount:      false,
    refetchOnWindowFocus:false,
    retry:               false
  });
}

export function useUserPermissions(email) {
  return useQuery({
    queryKey: ['admin', 'userPermissions', email],
    queryFn: async () => {
      const res = await authFetch(USER_PERMS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const raw = res[0]?.Permissions;
      return typeof raw === 'string' ? JSON.parse(raw) : {};
    },
    enabled:             !!email,
    staleTime:           0,
    cacheTime:           Infinity,
    refetchOnMount:      'always',
    refetchOnWindowFocus:false,
    retry:               false
  });
}

export function useUpdateUserPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, permissions }) => {
      await authFetch(UPDATE_PERMS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, permissions })
      });
    },
    onMutate: async ({ email, permissions }) => {
      await qc.cancelQueries({ queryKey: ['admin','userPermissions', email] });
      const previous = qc.getQueryData(['admin','userPermissions', email]);
      qc.setQueryData(['admin','userPermissions', email], permissions);
      return { previous, email };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(['admin','userPermissions', context.email], context.previous);
      }
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: ['admin','userPermissions', vars.email] });
    }
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] })
  });
}

export function usePricingModels() {
  return useQuery({
    queryKey: ['admin','pricingModels'],
    queryFn: fetchPricingModels,
    staleTime:           Infinity,
    cacheTime:           Infinity,
    refetchOnMount:      false,
    refetchOnWindowFocus:false,
    retry:               false
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ['admin','locations'],
    queryFn: fetchLocations,
    staleTime:           Infinity,
    cacheTime:           Infinity,
    refetchOnMount:      false,
    refetchOnWindowFocus:false,
    retry:               false
  });
}

export function useDevices() {
  console.log('[AdminDataContext] useDevices hook called.');
  return useQuery({
    queryKey: ['admin', 'devices'],
    queryFn: fetchDevices,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: 'always',
  });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ['admin','subscriptions'],
    queryFn: fetchSubscriptions,
    staleTime:           Infinity,
    cacheTime:           Infinity,
    refetchOnMount:      false,
    refetchOnWindowFocus:false,
    retry:               false
  });
}

export function useSubscriptionDetail(subscriptionId) {
  return useQuery({
    queryKey: ['admin','subscriptionDetail', subscriptionId],
    queryFn: () => fetchSubscriptionDetail(subscriptionId),
    enabled:             !!subscriptionId,
    staleTime:           0,
    cacheTime:           Infinity,
    refetchOnWindowFocus:false,
    retry:               false
  });
}

export function useSubscribers() {
  return useQuery({
    queryKey: ['admin','subscribers'],
    queryFn: fetchSubscribers,
    staleTime:           Infinity,
    cacheTime:           Infinity,
    refetchOnMount:      false,
    refetchOnWindowFocus:false,
    retry:               false
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['admin','plans'],
    queryFn: fetchPlans,
    staleTime:           Infinity,
    cacheTime:           Infinity,
    refetchOnMount:      false,
    refetchOnWindowFocus:false,
    retry:               false
  });
}

export function useSquarePlans() {
  return useQuery({
    queryKey: ['admin','squarePlans'],
    queryFn: fetchSquarePlans,
    staleTime:           Infinity,
    cacheTime:           Infinity,
    refetchOnMount:      false,
    refetchOnWindowFocus:false,
    retry:               false
  });
}

export function useDeprecatedSquarePlans() {
  return useQuery({
    queryKey: ['admin','deprecatedSquarePlans'],
    queryFn: fetchDeprecatedSquarePlans,
    staleTime:           1000 * 60 * 5,
    cacheTime:           1000 * 60 * 10,
    refetchOnMount:      true,
    refetchOnWindowFocus:false,
    retry:               false
  });
}

export function useBenefits() {
  return useQuery({
    queryKey: ['admin','benefits'],
    queryFn: fetchBenefits,
    staleTime:           Infinity,
    cacheTime:           Infinity,
    refetchOnMount:      false,
    refetchOnWindowFocus:false,
    retry:               false
  });
}

export function useEntitlements() {
  return useQuery({
    queryKey: ['admin','entitlements'],
    queryFn: fetchEntitlements,
    staleTime:           Infinity,
    cacheTime:           Infinity,
    refetchOnMount:      false,
    refetchOnWindowFocus:false,
    retry:               false
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['teamMembers'], 
    queryFn: () => authFetch(RETRIEVE_TEAM_MEMBERS_URL).then(data => Array.isArray(data) ? data : []),
    staleTime: 1000 * 60 * 5,
  });
};

export function useCreateBenefit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBenefit,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin','benefits'] })
  });
}

export function useUpdateBenefit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateBenefit,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin','benefits'] })
  });
}

export function useDeleteBenefit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBenefit,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin','benefits'] })
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin','subscriptions'] })
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateSubscription,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin','subscriptions'] });
      qc.invalidateQueries({ queryKey: ['admin','subscriptionDetail'] });
    }
  });
}

export const addPlan = (payload) =>
  authFetch(CREATE_PLAN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export function useAddPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addPlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plans'] })
  });
}

export const updatePlan = (payload) =>
  authFetch(UPDATE_PLAN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updatePlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plans'] })
  });
}

export const deletePlan = (planId) =>
  authFetch(DELETE_PLAN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: planId }),
  });

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plans'] })
  });
}

export function useRedeemEntitlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: redeemEntitlement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'entitlements'] });
    },
  });
}

export function useValidateAndAssignUUID() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: verifyDevice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'devices'] });
      qc.invalidateQueries({ queryKey: ['admin', 'user-access'] });
    },
  });
}

export function useRetrieveNetSales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: retrieveNetSales,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'dailyRevenue'] });
    },
  });
}

export function useRetrieveLabor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: retrieveLabor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'dailyRevenue'] });
    },
  });
}

export function useRetrieveOrdersByDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: retrieveOrdersByDay,
  });
}

export function useTriageUploadedCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triageUploadedCsv,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'dailyRevenue'] });
    },
  });
}

export function useCreateSquarePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSquarePlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'squarePlans'] })
  });
}

export function useCreateSquarePlanVariation(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSquarePlanVariation,
    onSuccess: (data, variables, context) => {
      qc.invalidateQueries({ queryKey: ['admin', 'squarePlans'] });
      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    onError: options.onError,
  });
}

export function useDeprecateSquarePlanVariation(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deprecateSquarePlanVariation,
    onSuccess: (data, variables, context) => {
      qc.invalidateQueries({ queryKey: ['admin', 'squarePlans'] });
      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    onError: options.onError,
  });
}