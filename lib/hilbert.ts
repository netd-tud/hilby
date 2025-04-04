/*
    Shamelessly lifted from https://github.com/measurement-factory/ipv4-heatmap/blob/master/bbox.c as this implementation is very pretty and can be adapted for our use easily.
*/

import { Address4, Address6 } from "ip-address";

const bigIntMinAndMax = (...args: bigint[]) => {
    return args.reduce(([min,max], e) => {
       return [
         e < min ? e : min, 
         e > max ? e : max,
       ];
    }, [args[0], args[0]]);
  };

const bigIntMax = (...args: bigint[]) => args.reduce((m, e) => e > m ? e : m);
const bigIntMin = (...args: bigint[]) => args.reduce((m, e) => e < m ? e : m);

const bounding_box = (first: bigint, slash: bigint, topPrefix: Address6 | Address4) => {
    const box = {
        xmin: 0n,
        ymin: 0n,
        xmax: 0n,
        ymax: 0n,
    }
    let diag = 0xAAAAAAAAn;

    let x1 = 0n, y1 = 0n, x2 = 0n, y2 = 0n;

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

        [box.xmin, box.xmax] = bigIntMinAndMax(x1,x2);
        [box.ymin, box.ymax] = bigIntMinAndMax(y1,y2);

    } else {
        /*
        * rectangle: divide, conquer
        */
        const b1 = bounding_box(first, slash + 1n,topPrefix);
        const b2 = bounding_box(first + (1n << (32n - (slash + 1n))), slash + 1n,topPrefix);

        [box.xmin, box.xmax] = bigIntMinAndMax(b1.xmin,x2);
        [box.ymin, box.ymax] = bigIntMinAndMax(y1,y2);

        box.xmin = bigIntMin(b1.xmin, b2.xmin);
        box.ymin = bigIntMin(b1.ymin, b2.ymin);
        box.xmax = bigIntMax(b1.xmax, b2.xmax);
        box.ymax = bigIntMax(b1.ymax, b2.ymax);
    }
    return box;
}

const xy_from_ip = (ip: bigint, topPrefix: Address4 | Address6) => {
    let s;
    const maxSubnetSize = topPrefix instanceof Address4 ? 32: 128;
    if (ip < topPrefix.startAddress().bigInt())
        return [0n, 0n];
    if (ip > topPrefix.endAddress().bigInt())
        return [0n, 0n];
    s = ip - topPrefix.startAddress().bigInt();
    const [x, y] = hil_xy_from_s(s, (maxSubnetSize - topPrefix.subnetMask)/2);
    return [x, y];
}

const hil_xy_from_s = (s: bigint, order: number) => {

    let i;
    let state, x, y, row;

    state = 0n;			/* Initialize. */
    x = y = 0n;

    const convertedOrder = BigInt(order);

    for (i = 2n * convertedOrder - 2n; i >= 0n; i -= 2n) {	/* Do n times. */
        row = 4n * state | ((s >> i) & 3n);	/* Row in table. */
        x = (x << 1n) | ((0x936Cn >> row) & 1n);
        y = (y << 1n) | ((0x39C6n >> row) & 1n);
        state = (0x3E6B94C1n >> 2n * row) & 3n;	/* New state. */
    }
    return [x, y]
}

export { bounding_box };