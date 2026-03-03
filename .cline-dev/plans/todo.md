# Mimirr Todo List

## FIXED & TESTED
- [x] fix inconsistency of status order buttons between My Requests and All Requests (the All status button should be at the end, like it is on the All Requests admin page)
- [x] update My Requests feature to only show requests that the logged in user requested (currently shows them all requests even from other users)
- [x] ensure that All Requests (admin feature) truly shows every request from every user (including themselves)
- [x] check what the "0" digit is on the book request page beneath the author (I believe this is supposed to be the rating? If so, that should be displayed as star icons.)
- [x] fix a bug with the "Check Status Now" button on the My Request page, it's not vertically aligned with the other status buttons there, like it should be (this works properly on the All Requests page for admins)
- [x] visualize requests in some way with the user that requested them
- [x] fix a bug where when a new author is added to bookshelf via the mimirr request, the author is set to monitor new books
- [x] navigating to My Requests or All Requests should default user to the first state button "Pending"
- [x] book cards in the search results, popular books, new releases, recommended authors still show "0" instead of the rating (we fixed this for request pages)
- [x] fix `UNIQUE constraint failed: Editions.ForeignEditionId` / `Value cannot be null` errors in Bookshelf integration
- [x] ensure authors are added as monitored but without auto-monitoring their entire bibliography

## IN PROGRESS (Coded, Needs Testing/Review)
- [ ] fix `Sequence contains no matching element` error in Bookshelf AddSkyhookData during book addition
    - **Status**: Aligned `bookToAdd` payload perfectly with Readarr's `getNewBook.js` frontend logic. Spreads the original `bookMatch` lookup result directly instead of synthetically manipulating the `editions` array.

## PENDING (Not Tackled Yet)
- *(No items pending)*
