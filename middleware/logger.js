/** @import { Request } from '../lib/http' */

import { Logger } from '../lib/colorful_log.js';

/**
 * @param {string} dir
 */
export function logger(dir) {
    const logger = new Logger();

    /**
     * @param {Request} req
     */
    return (req) => {
        const date = new Date();
        logger
            .color("white").append(`[${date.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: '2-digit' })} ${date.toLocaleTimeString('en-US', { hourCycle: 'h24' })}]`)
            .color("cyan").append(" INFO: ")
            .color("green").append(`${req.method}${' '.repeat(6 - req.method.length)}`)
            .color("blue").append(`${req.url}`)
            .log()
            .clear();
    }
}
