const stringSearch = (string, string_array) => {
    let start = 0,
        stop = string_array.length - 1,
        middle = Math.floor((stop + start) / 2);

    while(string_array[middle] !== string && start < stop){
        if (string.localeCompare(string_array[middle]) === -1){
            stop = middle - 1;
        } else if (string.localeCompare(string_array[middle] === 1)){
            start = middle + 1;
        }


        middle = Math.floor((stop + start)/2);
    }
    return (string_array[middle] !== string) ? -1 : middle;
}

module.exports.stringSearch = stringSearch