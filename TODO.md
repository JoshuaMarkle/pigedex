# To do list

Lists *(stable sort/ordered by priority)*

- Main features: need implementation
- Bug fixes: need fixing
- Future features: optional implementation
- Future bug fixes: optional fixes

Main Features

- Picture upload
  - Properly setup Supabase
  - 1 profile picture; up to 4 other pictures
  - Editable on indivdual page; show pfp across site
- Use current location
  - When ever creating/editing flight information
  - Prompt classic web popup
- Address searching
  - Integrate Nominatim address search engine
  - Goto/highlight location but don't select

Bug Fixes

- Flights page:
  - Not mobile friendly UI layout
    - Good PC layout; need to detect PC vs mobile
    - Should use tab based system for mobile: Flights tab (list all the flights), Map tab (show the large map with all flights)
  - When editing flight -> can't edit birds
    - Should be able to change birds that participate within flight
  - Flights page sidebar header
    - Change from |filter|
    - Change to: |"Flights"|plus icon; button to add flight|?space/right tab|filter|
  - Zoom too far out; default zoom should be much closer (center on home location)
  - Create new flight -> birds don't appear on render -> need to refresh for correct render
    - Should instead correctly render birds after creation
  - Reverse flight order in sidebar, recent flights on top
  - Indicate flight times of birds on sidebar
- Catalog: Search doesn't persist
  - Clicking back button after traveling into indivdual page should retain search + filters
- Dashboard: Add flights from indivdual page
  - Add external link after "Flights [link icon]" title
- Catalog: switch status and band id on bird card
  - Display band id with correct band color - bird status instead goes underneath the bird name
- Dashboard: Nodes allow arrows to be dragged out of top/bottom (doesn't work/connect but annoying)
- Dashboard: Pigeon node popup should have a link to the individual page (external link icon next to name is okay)
- Flights: Undo location change
- Top navbar:
  - reduce padding between main nav and buttons
  - Change bird/flight icons into plus icons
  - Fix not signed in to not render instantly

Future/Extra Features

- Awards/badges
- Flight planner
- Family tree settings
  - Connect siblings
  - Order by birthday (Fix y values)
- Multiple Users
  - Display demo data when unauthenticated
- Offline mode

Future Bug Fixes

- Quick render + loading UI
- Fix dashboard popup positioning
- Dashboard popup: reduce complexity more of a display card
  - Display name/band id; display birthday + editable status; editable parent 1/2; notes
- Editing the coop home location and unit of distance breaks all entries; should update distances of all flights
  - The distance stored in the database is a bit redundant (could be calculated) but its okay; just needs update if change of unit (mi/km)
