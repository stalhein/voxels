const CHUNK_SIZE = 16;
const CELL_SIZE = 6;
const WORLD_CELL_SIZE = CELL_SIZE * CHUNK_SIZE;

export class Worley {
    constructor(seed) {
        this.seed = seed;
    }

    hash(x, z) {
        const dot = (x * 19.846) + (z * 87.046);
        const num = Math.sin(dot) * 8724.9927;
        return num - Math.floor(num);
    }

    getRandomCellPoint(cx, cz) {
        const xp = this.hash(cx, cz + this.seed);
        const zp = this.hash(cz, cx + this.seed);

        return {
            x: (cx * WORLD_CELL_SIZE) + (xp * WORLD_CELL_SIZE),
            z: (cz * WORLD_CELL_SIZE) + (zp * WORLD_CELL_SIZE),
            biome: Math.floor(this.hash(cx+3, cz+8) * 5)
        };
    }

    getBiomeAt(wx, wz) {
        const cx = Math.floor(wx / WORLD_CELL_SIZE);
        const cz = Math.floor(wz / WORLD_CELL_SIZE);

        let minimumDistanceSqrd = Infinity;
        let biome = 0;

        for (let x = -1; x <= 1; ++x) {
            for (let z = -1; z <= 1; ++z) {
                const point = this.getRandomCellPoint(cx+x, cz+z);

                const dx = wx - point.x;
                const dz = wz - point.z;
                const distanceSqrd = dx*dx+dz*dz;

                if (distanceSqrd < minimumDistanceSqrd) {
                    minimumDistanceSqrd = distanceSqrd;
                    biome = point.biome;
                }
            }
        }

        return biome;
    }
}