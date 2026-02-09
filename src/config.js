export const CONFIG = {
    GRID_SIZE: 40,
    CELL_SIZE: 10, // World units per cell

    // Grid Types
    TYPES: {
        EMPTY: 0,
        ROAD_MAJOR: 1,
        ROAD_MINOR: 2, // Deprecated but ID kept
        LOT: 3,
        BUILDING: 4,
        PARK: 5,
        SCHOOL: 6,
        HOSPITAL: 7,
        FIRE_STATION: 8,
        BUILDING_RESIDENTIAL: 9,
        BUILDING_COMMERCIAL: 10
    },

    // Visuals
    COLORS: {
        GROUND: 0x2b2b2b,
        GRID_LINES: 0x333333,
        ROAD_MAJOR: 0x555555,
        ROAD_MINOR: 0x444444,
        LOT_GRASS: 0x2d4c1e,
        HOSPITAL: 0xffffff,
        FIRE_STATION: 0xb93a32,
    },

    PALETTE: [
        0xe63946, 0xf1faee, 0xa8dadc, 0x457b9d, 0x1d3557, // Modern Blue/Red
        0x2a9d8f, 0xe9c46a, 0xf4a261, 0xe76f51, // Earth Tones
        0xd8e2dc, 0xffe5d9, 0xffcad4, 0xf4acb7, 0x9d8189, // Pastels
        0x8d99ae, 0xedf2f4, 0xef233c, 0xd90429 // Grey/Red
    ],

    SIM_SPEEDS: [0, 1, 2, 4, 10] // Pause, Normal, Fast, Superfast, Hyper
};
