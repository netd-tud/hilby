import { ip2long, long2ip } from 'netmask';
import { Address6 } from 'ip-address';

/**
 * Generates a list of IPv4 prefixes to expand the view.
 * This function creates a set of prefixes covering the start of the IPv4 space,
 * progressively increasing in specificity.
 */
export const generateIPv4ExpansionPrefixes = (): string[] => {
    const base = ip2long("0.0.0.0");
    const prefixes: string[] = [];

    // Iterate through prefix lengths 0, 2, 4, 6
    for (let i = 0; i < 8; i += 2) {
        let itr = base;
        // Calculate the step size (number of addresses) for the current prefix length
        const ctr = (1 << (32 - i));
        
        // We only need to do 0.875 because of the unused 224/4 and 240/4
        for (let j = 0; j < (1 << (i)) * 0.875; j++) {
            const prefix = long2ip(itr) + "/" + i.toString();
            prefixes.push(prefix);
            itr += ctr;
        }
    }
    return prefixes;
};

/**
 * Generates a list of IPv6 prefixes to expand the view.
 * @param topPrefix The current top-level prefix (e.g., "2000::/4")
 */
export const generateIPv6ExpansionPrefixes = (topPrefix: string): string[] => {
    const base = new Address6(topPrefix).bigInt();
    const prefixes: string[] = [];
    
    // Iterate through prefix lengths 4, 6, 8 (BigInts)
    for (let i = 4n; i < 10n; i += 2n) {
        let itr = base;
        // Calculate the step size (number of addresses)
        const ctr = (1n << (128n - i));
        
        // Generate subnets
        for (let j = 0n; j < (1n << (i - 4n)); j++) {
            const prefix = Address6.fromBigInt(itr).correctForm() + "/" + i.toString();
            prefixes.push(prefix);
            itr += ctr;
        }
    }
    return prefixes;
};
