/*
    Shamelessly lifted from https://github.com/measurement-factory/ipv4-heatmap/blob/master/bbox.c as this implementation is very pretty and can be adapted for our use easily.
*/

import { Address4, Address6 } from "ip-address";

const bounding_box = (first: bigint, slash: bigint, topPrefix: Address6 | Address4) => {
    const isIPv6 = topPrefix instanceof Address6;
    const maxSubnetMask = isIPv6 ? 32n : 32n;
    
    const box = {
        xmin: 0,
        ymin: 0,
        xmax: 0,
        ymax: 0,
    }
    let diag = isIPv6 ? 0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAn : 0xAAAAAAAAn;

    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

    if (slash === maxSubnetMask) {
        /*
         * treat single address as a special case
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
        const b2 = bounding_box(first + (1n << (maxSubnetMask - (slash + 1n))), slash + 1n,topPrefix);

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
    const maxSubnetSize = topPrefix instanceof Address4 ? 32 : 32;
    if (ip < topPrefix.startAddress().bigInt())
        return [0, 0];
    if (ip > topPrefix.endAddress().bigInt())
        return [0, 0];
    s = ip - topPrefix.startAddress().bigInt();

    const [x_big, y_big] = hil_xy_from_s(s, (maxSubnetSize - topPrefix.subnetMask)/2);
    
    /*
        This should always create a value < SAFE_MAX_INT and is consistent for same size subnets, 
        which is the only level we need these values on. 
    */ 

    const factor = 1n << BigInt(maxSubnetSize - topPrefix.subnetMask) /100n;
    
    return [Number(x_big/factor), Number(y_big/factor)];
}

const hil_xy_from_s = (s: bigint, order: number) => {
    let i;
    let state, x, y, row;

    state = 0n;			/* Initialize. */
    x = y = 0n;
    const convertedOrder = BigInt(order);

    for (i = 2n * convertedOrder - 2n; i >= 0n; i -= 2n) {	/* Do n times. */
        row = 4n * state | (BigInt.asUintN(128, s) >> BigInt(i)) & 3n;	/* Row in table. */
        x = (x << 1n) | ((0x936Cn >> row) & 1n);
        y = (y << 1n) | ((0x39C6n >> row) & 1n);
        state = (0x3E6B94C1n >> 2n * row) & 3n;	/* New state. */
        //console.log(row, x,y,state, (0x3E6B94C1n >> 2n * row))
        //console.log(BigInt.asUintN(128, s) >> BigInt(i), (BigInt.asUintN(128, s) >> BigInt(i)).toString(16))
    }

    return [x, y]
}

export { bounding_box };