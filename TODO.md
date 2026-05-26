# To do list

Home

- account -> settings
  - connect siblings
  - order by birthday (fix y values)
- popup
  - fix weird positioning

---

Backburner

- Loading
- quick render + prompt password
- show demo data
- [fix] sign in may be broken - stuck
- Award system
  - give pigeons custom awards (e.g. founder pigeon, medal of honor)
  - can reuse awards
  - display like badges
    - special effects?
  - awards given could be a stat

---

Tonight

- Publish on vercel
- Make sure main features are working

---

Flights

- create page (/flights)
  - list out like normal airplace flights
  - similiar to add pigeon system to add flights
  - make it have a real map (react leaflet seems like the cheapest/simplest)
    - show home location (set like global setting)
    - show start location
    - if possible draw a line between them (label that distance)
  - make it work with supabase

Fixes Round 1

- (bug) Need easy way to set home location (everything breaks down without it)
- Remake the top navbar
  - copy/paste current TopNav component and make the left button a dialog for flight settings (change home) and the right button the add flight button (opens add flight dialog)
- main map
  - make the entire background just the map; remove stats and title
  - (bug) the map on the page has a higher z value than the dialog and should not render over top of the dialog
- flight listings
  - good UI; make into a left floating sidebar instead absolute with padding=4 from top/left/bottom

Fixes Round 2

- make default flight status active
  - if all pigeons are home -> auto set status to complete (can be done in editing)
- add flight dialog additions
  - status checkbox for the pigeons
    - when when creating flight create a checkbox after selecting the pigeons that will set statuses of all selected pigeons to flying (default true for active flights)
  - if a completed flight -> add checkbox asking if all pigeons were successful (setting the result field)
    - if yes; then all pigeon results are success; if false; all flights are still unknown
- edit flights on the sidebar
  - create a popup that allows for editing statuses
  - make pigeon edits inline: (pigeon name)(space if possible)(status dropdown)(flight time input;none)
    - would be nice if there is a format to the flight time so its standard in the database like Xd Xh Xm Xs and its covvert to seconds for the database
  - save changes button

Fixes Round 3

- add top navbar to catalog page
- catalog make successful flights work; a returned pigeon is a successful flight; just looks through the flight_pigeons table
- make individual pigeon page
  - ignore actual images right now; will add uploads later
  - make with the assumption there will be a profile picture and other just images
  - similar style to the catalog; should also have top navbar without left and right buttons
  - everything about the pigeon is editable
  - can view all flights that pigeon went on with times

Fixes Round 4

- When not authenticated
  - not able to add flights on the flights/
