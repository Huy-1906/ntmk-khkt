// Dữ liệu khớp bảng ELEMENTS + ionicTransfer trong core.cpp
// shells = [K, L, M, N]; transfer = số e nhường (kim loại) / nhận (phi kim)
window.ELEMENTS = {
  metal: [
    { z: 3,  symbol: 'Li', name: 'Liti',   shells: [2, 1, 0, 0], transfer: 1, noble: 'He' },
    { z: 11, symbol: 'Na', name: 'Natri',  shells: [2, 8, 1, 0], transfer: 1, noble: 'Ne' },
    { z: 12, symbol: 'Mg', name: 'Magie',  shells: [2, 8, 2, 0], transfer: 2, noble: 'Ne' },
    { z: 13, symbol: 'Al', name: 'Nhôm',   shells: [2, 8, 3, 0], transfer: 3, noble: 'Ne' },
    { z: 19, symbol: 'K',  name: 'Kali',   shells: [2, 8, 8, 1], transfer: 1, noble: 'Ar' },
    { z: 20, symbol: 'Ca', name: 'Canxi',  shells: [2, 8, 8, 2], transfer: 2, noble: 'Ar' },
  ],
  nonmetal: [
    { z: 1,  symbol: 'H',  name: 'Hiđro',      shells: [1, 0, 0, 0], transfer: 1, noble: 'He' },
    { z: 7,  symbol: 'N',  name: 'Nitơ',       shells: [2, 5, 0, 0], transfer: 3, noble: 'Ne' },
    { z: 8,  symbol: 'O',  name: 'Oxi',        shells: [2, 6, 0, 0], transfer: 2, noble: 'Ne' },
    { z: 9,  symbol: 'F',  name: 'Flo',        shells: [2, 7, 0, 0], transfer: 1, noble: 'Ne' },
    { z: 15, symbol: 'P',  name: 'Phốt pho',   shells: [2, 8, 5, 0], transfer: 3, noble: 'Ar' },
    { z: 16, symbol: 'S',  name: 'Lưu huỳnh',  shells: [2, 8, 6, 0], transfer: 2, noble: 'Ar' },
    { z: 17, symbol: 'Cl', name: 'Clo',        shells: [2, 8, 7, 0], transfer: 1, noble: 'Ar' },
  ],
};

window.NOBLE_GAS_NAMES = { He: 'Heli', Ne: 'Neon', Ar: 'Argon' };
