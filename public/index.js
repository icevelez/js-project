import { connectRemote } from "./remote.js";

/** @import RemoteFunction from '../remote_api.js' */
/** @type {RemoteFunction} */
const REMOTE = connectRemote("/api/remote", {
    'x-auth': 'jeff'
});

const data = await REMOTE.example_function({
    example_data: "hello_world",
    test_map: new Map(),
    test_set: new Set([1, 2, 3, 4, 5]),
    test_date: new Date(),
},
    new Map([[1, 2243], ['hello', '3253']]),
    new Set(['a', 'b', 'c', 'd']),
    new Date(),
    "XXXXX",
    1251352,
    { 'x': 'hello' },
)
console.log(data);
