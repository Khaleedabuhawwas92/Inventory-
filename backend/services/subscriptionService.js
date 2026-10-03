// Subscription metadata (plan/subscriptionStatus/subscriptionEndsAt — see
// models/Organization.js) is manually set by a Platform Admin only: no
// payment gateway, no cron job that ever flips subscriptionStatus on its
// own. That means a stored subscriptionStatus of 'ACTIVE' proves nothing by
// itself — it's just whatever an admin last typed, and nothing keeps it in
// sync with subscriptionEndsAt actually passing. This computes the
// *effective* state fresh on every check instead of trusting that stored
// field, so an organization past its end date is treated as expired the
// moment "now" crosses it — not whenever someone next remembers to update a
// label.
function getEffectiveSubscriptionStatus(org) {
  // An explicit platform-admin override always wins, independent of plan/dates.
  if (org.subscriptionStatus === 'SUSPENDED') return 'SUSPENDED';

  // FREE is permanent by definition in this system — it never expires on
  // date alone, regardless of whatever subscriptionEndsAt happens to be set
  // to (the platform-admin UI shouldn't even show that field as meaningful
  // for a FREE org — see platform-admin SubscriptionTab.vue).
  if (org.plan === 'FREE') return 'ACTIVE';

  if (org.subscriptionEndsAt && org.subscriptionEndsAt.getTime() <= Date.now()) {
    return org.plan === 'TRIAL' ? 'TRIAL_EXPIRED' : 'EXPIRED';
  }

  if (org.subscriptionStatus === 'PAST_DUE') return 'PAST_DUE';

  return 'ACTIVE';
}

// PAST_DUE is deliberately NOT blocking — with no payment gateway behind it,
// it's purely an admin-set label with no defined grace-period policy in this
// system, so treating it as access-blocking would be inventing a policy
// nobody asked for. EXPIRED/TRIAL_EXPIRED/SUSPENDED are the only states this
// system actually restricts access for.
const BLOCKING_STATUSES = ['EXPIRED', 'TRIAL_EXPIRED', 'SUSPENDED'];

function isBlocked(org) {
  return BLOCKING_STATUSES.includes(getEffectiveSubscriptionStatus(org));
}

const BLOCK_MESSAGES = {
  EXPIRED: 'انتهت صلاحية اشتراك مؤسستك، الرجاء التواصل مع الدعم لتجديد الاشتراك',
  TRIAL_EXPIRED: 'انتهت الفترة التجريبية لمؤسستك، الرجاء التواصل مع الدعم للاشتراك',
  SUSPENDED: 'تم تعليق اشتراك مؤسستك، الرجاء التواصل مع الدعم',
};

// `code` always carries the SUBSCRIPTION_ prefix (SUBSCRIPTION_EXPIRED /
// SUBSCRIPTION_TRIAL_EXPIRED / SUBSCRIPTION_SUSPENDED) so callers — and the
// tenant frontend's response interceptor — can recognize "this is a
// subscription block" as one category without hardcoding each specific
// status string.
function getBlockInfo(org) {
  const status = getEffectiveSubscriptionStatus(org);
  if (!BLOCKING_STATUSES.includes(status)) return null;
  return { status, code: `SUBSCRIPTION_${status}`, message: BLOCK_MESSAGES[status] };
}

module.exports = { getEffectiveSubscriptionStatus, isBlocked, getBlockInfo };
