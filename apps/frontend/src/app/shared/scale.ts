export interface RawScale {
  _id: string,
  token_id: number,
  name: string,
  image_url: string,
  image_thumbnail_url: string,
  contract_address: string,
  painting: string,
  position: {
    name: string,
    row: number,
    col: number,
    row_count: number,
    col_count: number,
    index: number
  },
  owner: {
    address: string,
    owner_id: string
  },
  last_updated: {
    timestamp: string
  }
}

export interface Scale extends RawScale {
  owned_by_us: boolean
}

export function mapScale(s: RawScale): Scale {
  return {
    ...s,
    owned_by_us: false
  }
}

// ok, this is a bit complicated, next time I will use a library for this :D

type GroupedScales = {
  [key: string]: Scale[]
};

type GroupedGroupedScales = {
  [key: string]: GroupedScales
};

export function groupScalesByParentPaintingAndRow(scales: Scale[]): GroupedGroupedScales {

  const groupedByParent: GroupedScales = scales.reduce(
    (acc: GroupedScales, item: Scale) => ({
      ...acc,
      [item.painting]: [...(acc[item.painting] ?? []), item],
    }),
    {},
  );

  const groupedByParentAndRow: GroupedGroupedScales = {};
  Object
    .keys(groupedByParent)
    .forEach((key) => {
      const group: Scale[] = groupedByParent[key];
      const groupedByRow = groupScalesByRow(group);
      groupedByParentAndRow[key] = groupedByRow;
    }
  );

  return groupedByParentAndRow;
}

export function groupScalesByRow(scales: Scale[]): GroupedScales {
  return scales.reduce(
    (acc: GroupedScales, item: Scale) => ({
      ...acc,
      [item.position.row]: [...(acc[item.position.row] ?? []), item],
    }),
    {},
  );
}

export function toArrayOfArrayOfArray(groupedgroupedScales: GroupedGroupedScales): Scale[][][] {
  const result: Scale[][][] = [];

  Object
    .keys(groupedgroupedScales)
    .sort((a, b) => a.localeCompare(b))
    .forEach((key) => {
      const group = groupedgroupedScales[key];
      result.push(toArrayOfArray(group));
    }
  );

  return result;
}

export function toArrayOfArray(groupedScales: GroupedScales): Scale[][] {
  const result: Scale[][] = [];

  Object
    .keys(groupedScales)
    .sort((a, b) => a.localeCompare(b))
    .forEach((key) => {
      const group = groupedScales[key];
      const sortedByColumn = group.sort((a, b) => a.position.col - b.position.col);
      result.push(sortedByColumn);
    }
  );

  return result;
}


