import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from "recharts";
import {PureComponent, useEffect, useState} from "react";
import axios from "axios";
import {useLocation} from "react-router-dom";

export default function Chart() {
    const [data, setData] = useState([]);
    const location = useLocation();

    useEffect(() => {
        if (data.length === 0){
            console.log(location.state);
            fetchData();
        }
    }, [data, setData])

    const fetchData = () => {
        const options = {
            method: 'POST',
            url: '/api/generate_chart',
            headers: {'Content-Type': 'application/json'},
            data: {instrument_ids: JSON.stringify(location.state.ids), stock_proportion: JSON.stringify(location.state.proportion)}
        };

        axios.request(options).then((response) => {
            setData(response.data);
        }).catch(function (error) {
            console.error(error);
        });
    }


    return (
        <div className="App">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    width={500}
                    height={300}
                    data={data}
                    margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey="date"/>
                    <YAxis/>
                    <Tooltip/>
                    <Legend/>
                    <Line type="monotone" dataKey="Index Growth" stroke="#8884d8" activeDot={{r: 8}}/>
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}