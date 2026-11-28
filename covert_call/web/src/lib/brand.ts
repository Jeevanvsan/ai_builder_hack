// Single place for the app's display name on web (Epic 13.1). The web build isn't user-customisable (that's the
// native app), but keeping the name in one constant means there's one thing to change, and it matches the native
// app's `appearance` module conceptually.
//
// QuickOne (Epic 33): the multi-service app (food, groceries, medicines, home services) that replaced QuickBite on
// this branch. The React Native app and the frozen food prompt it imports still say QuickBite.
export const APP_NAME = 'QuickOne'
// The call screen's avatar and the order-ID prefix.
export const APP_INITIALS = 'QO'
