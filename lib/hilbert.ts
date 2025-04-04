/*
    Shamelessly lifted from https://github.com/measurement-factory/ipv4-heatmap/blob/master/bbox.c as this implementation is very pretty and can be adapted for our use easily.
*/

import { Address4, Address6 } from "ip-address";

// const bigIntMinAndMax = (...args: bigint[]) => {
//     return args.reduce(([min,max], e) => {
//        return [
//          e < min ? e : min, 
//          e > max ? e : max,
//        ];
//     }, [args[0], args[0]]);
//   };

// const bigIntMax = (...args: bigint[]) => args.reduce((m, e) => e > m ? e : m);
// const bigIntMin = (...args: bigint[]) => args.reduce((m, e) => e < m ? e : m);

const bounding_box = (first: bigint, slash: bigint, topPrefix: Address6 | Address4) => {
    const box = {
        xmin: 0,
        ymin: 0,
        xmax: 0,
        ymax: 0,
    }
    let diag = 0xAAAAAAAAn;

    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

    if (slash > 31) {
        /*
         * treat /32 as a special case
         */
        [x1, y1] = xy_from_ip(first, topPrefix);
        box.xmin = x1;
        box.ymin = y1;
        box.xmax = x1;
        box.ymax = y1;
    } else if (0n === (slash & 1n)) {
        /*
        * square
        */

        diag = diag >> slash;

        [x1, y1] = xy_from_ip(first, topPrefix);
        [x2, y2] = xy_from_ip(first + diag, topPrefix);

        box.xmin = Math.min(x1,x2);
        box.xmax = Math.max(x1,x2);

        box.ymin = Math.min(y1,y2);
        box.ymax = Math.max(y1,y2);


    } else {
        /*
        * rectangle: divide, conquer
        */
        const b1 = bounding_box(first, slash + 1n,topPrefix);
        const b2 = bounding_box(first + (1n << (32n - (slash + 1n))), slash + 1n,topPrefix);

        box.xmin = Math.min(x1,x2);
        box.xmax = Math.max(x1,x2);

        box.ymin = Math.min(y1,y2);
        box.ymax = Math.max(y1,y2)

        box.xmin = Math.min(b1.xmin, b2.xmin);
        box.ymin = Math.min(b1.ymin, b2.ymin);
        box.xmax = Math.max(b1.xmax, b2.xmax);
        box.ymax = Math.max(b1.ymax, b2.ymax);
    }
    return box;
}

const xy_from_ip = (ip: bigint, topPrefix: Address4 | Address6) => {
    let s;
    const maxSubnetSize = topPrefix instanceof Address4 ? 32 : 128;
    if (ip < topPrefix.startAddress().bigInt())
        return [0, 0];
    if (ip > topPrefix.endAddress().bigInt())
        return [0, 0];
    s = ip - topPrefix.startAddress().bigInt();
    const [x, y] = hil_xy_from_s(s, (maxSubnetSize - topPrefix.subnetMask)/2);
    return [x, y];
}

const hil_xy_from_s = (s: bigint, order: number) => {

    let i;
    let state, x, y, row;

    state = 0;			/* Initialize. */
    x = y = 0;


    for (i = 2 * order - 2; i >= 0; i -= 2) {	/* Do n times. */
        console
        row = 4 * state | Number((s >> BigInt(i)) & 3n);	/* Row in table. */
        x = (x << 1) | ((0x936C >> row) & 1);
        y = (y << 1) | ((0x39C6 >> row) & 1);
        state = (0x3E6B94C1 >> 2 * row) & 3;	/* New state. */
    }
    return [x, y]
}

export { bounding_box };