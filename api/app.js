const express = require('express');
const app = express();
const port = process.env.PORT || 3001;
const axios = require("axios");
const dfd = require("danfojs-node")
const assert = require("assert");
const path = require("path");
const {stringSearch} = require("./helpers/misc");

const FOREX_PAIRS = require('./assets/forex_pairs.json');
const INSTRUMENTS_INFO = [...require('./assets/dukascopy_data/bonds.json'), ...require('./assets/dukascopy_data/efts.json'), ...require('./assets/dukascopy_data/commodities.json'), ...require('./assets/dukascopy_data/indices.json'), ...require('./assets/dukascopy_data/stocks.json')];

INSTRUMENTS_INFO.sort((first, second) => {
    return ('' + first.Instrument).localeCompare('' + second.Instrument);
})

const INSTRUMENTS_INFO_TICKER_FLAT = INSTRUMENTS_INFO.map((item) => item.Instrument);

const PRODUCTION_SERVER = process.env.NODE_ENV === "production";

// const instrument_ids = ["72044", "71556"];
// const stock_proportion = [0.3, 0.7];

const key = process.env.API_KEY;
const api_url = 'https://freeserv.dukascopy.com/2.0/';

app.use(express.json());

class DukascopyAPI {
    constructor(key, base_url) {
        this.key = key;
        this.base_url = base_url;
    }

    fetchInstrumentHistory(instrument_id, start = null, end = null, timeFrame = '1day', count = null) {
        return new Promise((async resolve => {
            if (!instrument_id) throw "Instrument ID invalid!";

            const params = {
                key: this.key,
                instrument: instrument_id,
                path: 'api/historicalPrices'
            }

            if (timeFrame) params["timeFrame"] = timeFrame;
            if (start) params["start"] = start;
            if (end) params["end"] = end;
            if (count) params["count"] = count;

            const options = {
                method: 'GET',
                url: this.base_url,
                params: params
            };

            let response = undefined;
            while (!response || response.data.id !== instrument_id){
                response = await axios.request(options);
            }
            resolve(response.data);
        }))
    }
}

class Instrument {
    constructor(instrument_id) {
        return (async () => {
            this.id = instrument_id;

            this.API = new DukascopyAPI(key, api_url);

            if (!Instrument.start) throw "Instrument start timestamp not set.";
            if (!Instrument.end) throw "Instrument end timestamp not set.";

            this.intervals = [];

            let tmp = Instrument.getStart();
            while (tmp <= Instrument.getEnd()) {
                this.intervals.push(tmp);
                tmp = tmp + 86400000
            }

            this.history = undefined;
            await this.getHistory();

            this.Instrument_Dataframe = new dfd.DataFrame({
                timestamp: this.intervals,
                closePrice: await this.getClosePrice(),
                growth: await this.getGrowth()
            });

            // console.log(this.id);
            // this.Instrument_Dataframe.print();
            return this;
        })();
    }

    getDF() {
        return this.Instrument_Dataframe;
    }

    static setStart(start) {
        this.start = start;
    }

    static getStart() {
        return this.start;
    }

    static setEnd(end) {
        this.end = end;
    }

    static getEnd() {
        return this.end;
    }

    getHistory() {
        return new Promise((resolve => {
            if (this.history !== undefined) {
                resolve(this.history)
            } else {
                this.API.fetchInstrumentHistory(this.id, Instrument.getStart(), Instrument.getEnd()).then((data) => {
                    // sort data
                    data.candles = [...data.candles.sort(function (a, b) {
                        if (a.timestamp < b.timestamp) {
                            return -1;
                        } else if (a.timestamp > b.timestamp) {
                            return 1;
                        } else {
                            return 0;
                        }
                    })];
                    this.history = data;
                    resolve(data);
                })
            }
        }));
    }

    getHistoryAt(timestamp) {
        return new Promise((resolve => {
            this.getHistory().then(data => {
                let result = data.candles.filter(candle => {
                    return candle.timestamp === timestamp;
                })
                if (result.length === 0) resolve(-1);
                resolve(result[0]);
            });
        }));
    }

    getClosePrice() {
        return new Promise((async resolve => {
            let candles = [];

            let lastAvailableCandle = null;
            for (const t_stamp of this.intervals) {
                let t_stamp_candle = await this.getHistoryAt(t_stamp);
                if (t_stamp_candle === -1) {
                    if (lastAvailableCandle){
                        candles.push({
                            "timestamp": t_stamp,
                            "bid_volume": null,
                            "bid_open": null,
                            "bid_close": lastAvailableCandle.bid_close,
                            "bid_low": null,
                            "bid_high": null
                        })
                    } else {
                        candles.push({
                            "timestamp": t_stamp,
                            "bid_volume": null,
                            "bid_open": null,
                            "bid_close": null,
                            "bid_low": null,
                            "bid_high": null
                        })
                    }
                } else {
                    candles.push(t_stamp_candle);
                    lastAvailableCandle = t_stamp_candle;
                }
            }

            let result = candles.map(item => {
                return item.bid_close
            });
            resolve(result);
        }))
    }

    getGrowth() {
        return new Promise((async resolve => {
            let instrumentClosePrice = await this.getClosePrice();
            let available_data_start = 0;

            while (instrumentClosePrice[available_data_start] == null){
                available_data_start++;
            }

            let basePrice = instrumentClosePrice[available_data_start];

            resolve([...instrumentClosePrice.map(price => {
                if (price != null) return (price - basePrice) / basePrice;
                return 0;
            })]);
        }))
    }
}

class CustomIndexMain {
    constructor(instruments_id, investment_proportion, start_timestamp, end_timestamp) {
        this.instruments_id = instruments_id;
        this.investment_proportion = investment_proportion;

        this.end_timestamp = end_timestamp - (end_timestamp % 86400000);
        this.start_timestamp = start_timestamp + (86400000 - (start_timestamp % 86400000));

        assert(this.start_timestamp < this.end_timestamp);

        Instrument.setStart(this.start_timestamp);
        Instrument.setEnd(this.end_timestamp);

        let intervals = [];

        let tmp = this.start_timestamp;
        while (tmp <= this.end_timestamp) {
            intervals.push(tmp);
            tmp = tmp + 86400000
        }

        let readable_time = intervals.map(ts => {
            return new Date(ts).toISOString().slice(0, 19).replace('T', ' ')
        });

        this.Full_DATA = new dfd.DataFrame({date: readable_time, timestamp: intervals});
    }

    gatherInstrumentsData = async () => {
        for (const instrument_id of this.instruments_id) {
            const ins = await new Instrument(instrument_id);
            const ins_growth = await ins.getGrowth();
            this.Full_DATA.addColumn("Instrument: " + instrument_id.toString(), ins_growth, {inplace: true});
        }
    }

    calculateIndexGrowth = () => {
        let indexGrowth = [];

        let total_rows = this.Full_DATA.column("timestamp").count();

        for (let row = 0; row < total_rows; row++){
            let growth = 0;
            let instrument_index = 0;
            for (const instrument_id of this.instruments_id){
                growth = growth + this.investment_proportion[instrument_index] * this.Full_DATA.column("Instrument: " + this.instruments_id[instrument_index].toString()).iat(row);
                instrument_index++;
            }
            indexGrowth.push(growth);
        }

        this.Full_DATA.addColumn("Index Growth", indexGrowth, {inplace: true});
    }

    display(){
        this.Full_DATA.print();
    }

    getFullData(){
        return this.Full_DATA;
    }
}

const validate_proportion = (proportion_list) => {
    return proportion_list.reduce((total, next) => {return total + next}) === 1;
}


if (PRODUCTION_SERVER){
    app.use(express.static(path.join(__dirname, 'build')));

    app.get('/', function (req, res) {
        res.sendFile(path.join(__dirname, 'build', 'index.html'));
    });
}

app.post('/api/generate_chart', async (req, res) => {
    let instrument_ids = JSON.parse(req.body.instrument_ids);
    let stock_proportion = JSON.parse(req.body.stock_proportion);
    let start_timestamp = req.body.start_timestamp;
    let end_timestamp = req.body.end_timestamp;

    if (!validate_proportion(stock_proportion)){
        res.status(400).send("Invalid proportion. Proportions must add up to 100%")
    } else {
        try {
            let custom_index = new CustomIndexMain(instrument_ids, stock_proportion, start_timestamp, end_timestamp);
            await custom_index.gatherInstrumentsData();
            custom_index.calculateIndexGrowth();
            if (!PRODUCTION_SERVER) custom_index.display();
            res.send(custom_index.getFullData().toJSON());
        } catch (e) {
            console.log(e);
            res.sendStatus(400);
        }
    }
});

app.get('/api/instruments', (req, res) => {
    const options = {
        method: 'GET',
        url: api_url,
        params: {path: 'api/instrumentList', key: key}
    };

    axios.request(options).then(function (response) {
        let instruments_data_dukascopy = [...response.data];
        instruments_data_dukascopy = instruments_data_dukascopy.map((item, index) => {
            let searchID = item.name;
            let search_index = stringSearch(searchID, FOREX_PAIRS);

            if (search_index === -1){
                // Not a forex pair
                search_index = stringSearch(searchID, INSTRUMENTS_INFO_TICKER_FLAT);

                if (search_index === -1){
                    return {...item, desc: "Unknown!"}
                } else {
                    return {...item, desc: INSTRUMENTS_INFO[search_index]["Description"]}
                }
            } else {
                // A forex pair
                return {...item, desc: "Currency Pair, Forex"}
            }
        })
        res.send(instruments_data_dukascopy);
    }).catch(function (error) {
        console.error(error);
        res.status(400);
    });
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});