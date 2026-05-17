# Pigeon Family Tree

A visualizer for the family tree of a pigeon coop.

## Features TBD

- Family tree
  - Pigeon node edits
    - Remove birthday precision (just string field not important)
    - Able to change parents
    - Able to add children
      - makes new popup that asks for the other parent (could be unknown)
      - add child button, brings up the new pigeon popup will filled in parents
    - Link to more detailed pigeon entry

- Flights page
  - map like google maps
  - maybe just a list of flights (like actual airline type ui)
    - each flight contains a way to select a location in the popup
  - will display if the pigeons are home/editing will update that pigeons status
- Catalog page
  - card view: display the pigeons like items on some marketplace (show images)
    - sort by...name, birthday, status, band id
    - filter by...name, birthday, status, band id
    - search feature

**Database Stuff**

- Pigeon data structure (updated)
  - hidden id, just for db stuff
  - name, brithday, status (home/flying/lost)
  - band id (?unknown), band color (default none; only used for ui rendering not imp)
  - parent 1, parent 2 (could both be unknown)
  - notes (just string for random information)
  - images, pfp (something to point to the image of choice/could be number or url)
- Flight data structure
  - hidden id, just for db stuff
  - date
  - location (lat/long on real map)
  - distance (calculated from the location back to home addr)
  - notes (for now other stuff like flight times etc)
- General
  - home location

**UI nicities**

- Loading information
- custom shadcn stuff

**Future stuff**

- flight times of pigeons

## Problems

- Deletions
  - Parent is deleted, children should remove that parent from their parent slot
- duplicate parents
