export function getPigeonById(pigeons, id) {
  return pigeons.find((pigeon) => pigeon.id === id) || null;
}

export function getParents(pigeons, pigeon) {
  return pigeon.parentIds
    .map((parentId) => getPigeonById(pigeons, parentId))
    .filter(Boolean);
}

export function getChildren(pigeons, parentId) {
  return pigeons.filter((pigeon) => pigeon.parentIds.includes(parentId));
}

export function getRootPigeons(pigeons) {
  return pigeons.filter((pigeon) => pigeon.parentIds.length === 0);
}

export function getFamilyRows(pigeons) {
  return pigeons.map((pigeon) => {
    const parents = getParents(pigeons, pigeon);
    const children = getChildren(pigeons, pigeon.id);

    return {
      pigeon,
      parents,
      children,
    };
  });
}

export function formatBirthday(pigeon) {
  if (!pigeon.birthday || pigeon.birthdayPrecision === "unknown") {
    return "Birthday unknown";
  }

  if (pigeon.birthdayPrecision === "year") {
    return pigeon.birthday;
  }

  if (pigeon.birthdayPrecision === "month") {
    return pigeon.birthday;
  }

  return pigeon.birthday;
}
