/*
    Shamelessly lifted from https://github.com/measurement-factory/ipv4-heatmap/blob/master/bbox.c as this implementation is very pretty and can be adapted for our use easily.
*/

import { ip2long, Netmask } from "netmask";

const bounding_box = (first: number, slash: number, topPrefix: string) => {
    const box = {
        xmin: 0,
        ymin: 0,
        xmax: 0,
        ymax: 0,
    }
    let diag = 0xAAAAAAAA;

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
    } else if (0 === (slash & 1)) {
        /*
        * square
        */

        diag = diag >>> slash;

        [x1, y1] = xy_from_ip(first, topPrefix);
        [x2, y2] = xy_from_ip(first + diag, topPrefix);

        box.xmin = Math.min(x1, x2);
        box.ymin = Math.min(y1, y2);
        box.xmax = Math.max(x1, x2);
        box.ymax = Math.max(y1, y2);
    } else {
        /*
        * rectangle: divide, conquer
        */
        const b1 = bounding_box(first, slash + 1,topPrefix);
        const b2 = bounding_box(first + (1 << (32 - (slash + 1))), slash + 1,topPrefix);
        box.xmin = Math.min(b1.xmin, b2.xmin);
        box.ymin = Math.min(b1.ymin, b2.ymin);
        box.xmax = Math.max(b1.xmax, b2.xmax);
        box.ymax = Math.max(b1.ymax, b2.ymax);
    }
    return box;
}

const xy_from_ip = (ip: number, topPrefix: string) => {
    let s;
    const net = new Netmask(topPrefix);

    if (ip < ip2long(net.first))
        return [0, 0];
    if (ip > ip2long(net.last))
        return [0, 0];
    s = (ip - ip2long(net.first)) >>> 0;
    const [x, y] = hil_xy_from_s(s, (32-net.bitmask)/2);
    return [x, y];
}

const hil_xy_from_s = (s: number, order: number) => {

    let i;
    let state, x, y, row;

    state = 0;			/* Initialize. */
    x = y = 0;

    for (i = 2 * order - 2; i >= 0; i -= 2) {	/* Do n times. */
        row = 4 * state | ((s >>> i) & 3);	/* Row in table. */
        x = (x << 1) | ((0x936C >>> row) & 1);
        y = (y << 1) | ((0x39C6 >>> row) & 1);
        state = (0x3E6B94C1 >>> 2 * row) & 3;	/* New state. */
    }
    return [x, y]
}

export { bounding_box };