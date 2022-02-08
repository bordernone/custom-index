const express = require('express');
const app = express();
const port = 3001;
const axios = require("axios");
const dfd = require("danfojs-node")
const assert = require("assert");

const instrument_ids = ["72044", "71556"];
const stock_proportion = [0.3, 0.7];

const key = "API-KEY";
const api_url = 'https://freeserv.dukascopy.com/2.0/';

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

app.get('/api', async (req, res) => {
    let custom_index =  new CustomIndexMain(instrument_ids, stock_proportion, 1641013320000, 1643673600000);
    await custom_index.gatherInstrumentsData();
    custom_index.calculateIndexGrowth();
    custom_index.display();
    res.send(custom_index.getFullData().toJSON());
});

app.get('/instruments', (req, res) => {
    const options = {
        method: 'GET',
        url: api_url,
        params: {path: 'api/instrumentList', key: key}
    };

    axios.request(options).then(function (response) {
        res.send(response.data);
    }).catch(function (error) {
        console.error(error);
        res.status(400);
    });
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});