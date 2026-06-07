# To do list

## Main Features

- Use current location
  - Always times out; doesn't seem to be working
- Address searching
  - Loads but doesn't dropdown queries
  - Integrate Nominatim address search engine
  - Goto/highlight location but don't select

## Bug Fixes

- Refresh for everything; app always requires many refreshes if it fails to get data or something
- Can't put in flight times when creating completed flight?
- Catalog could have better band color UI

## Future/Extra Features

- Awards/badges
- Flight planner
- Family tree settings
  - Connect siblings
  - Order by birthday (Fix y values)
- Multiple Users
  - Display demo data when unauthenticated
- Offline mode

## Future Bug Fixes

- Quick render + loading UI
- Fix dashboard popup positioning
- Editing the coop home location and unit of distance breaks all entries; should update distances of all flights
  - The distance stored in the database is a bit redundant (could be calculated) but its okay; just needs update if change of unit (mi/km)
