import {Button, FormControl, InputGroup} from 'react-bootstrap';
import './homepage.css';
import {useEffect, useState} from "react";
import axios from "axios";
import { useNavigate } from "react-router";
import LoadingOverlay from 'react-loading-overlay';

const instruments = new Map();

function Table({onSubmit}) {
    const [rowItemsList, setRowItemsList] = useState([]);
    const [numberOfElements, setNumberOfElements] = useState(0);

    const handleConfirmClick = () => {
        let items = [];
        let firstItem = instruments.keys().next().value;
        new Array(numberOfElements).fill(null).forEach((item, index) => {
            items.push({
                instrument_id: firstItem,
                proportion: 0
            })
        })
        setRowItemsList(items);
    }

    const handleInstrumentsCountChange = (e) => {
        if (!isNaN(e.target.value)) setNumberOfElements(parseInt(e.target.value));
    }

    const Row = ({index}) => {
        const [proportion, setProportion] = useState(rowItemsList[index].proportion);

        const handleSelectChange = (e) => {
            let newList = [...rowItemsList];
            newList[index].instrument_id = e.target.value;
            setRowItemsList(newList);
        }

        const options = () => {
            let select_options = [];
            instruments.forEach((instrument, index) => {
                select_options.push(<option key={index} value={instrument.id}>{instrument.name}</option>)
            });
            return select_options;
        }

        const getDesc = () => {
            if (rowItemsList[index].instrument_id) {
                return instruments.get(rowItemsList[index].instrument_id).name;
            }
            return "No instrument selected";
        }

        const handleInputChange = () => {
            let newList = [...rowItemsList];
            newList[index].proportion = proportion;
            setRowItemsList(newList);
        }

        return (
            <tr>
                <td>
                    <select onChange={handleSelectChange} value={rowItemsList[index].instrument_id}>
                        {options().map((data) => data)}
                    </select>
                </td>
                <td>{getDesc()}</td>
                <td><input onBlur={handleInputChange}
                           value={proportion}
                           onChange={(e) => {
                               setProportion(e.target.value)
                           }}/>
                </td>
            </tr>
        )
    }


    return (
        <div>
            <div>
                <InputGroup className="mb-3">
                    <FormControl
                        aria-describedby="basic-addon2"
                        onChange={handleInstrumentsCountChange}
                        value={numberOfElements}
                    />
                    <Button variant="outline-secondary" onClick={handleConfirmClick}>
                        Go
                    </Button>
                </InputGroup>
            </div>
            <table>
                <thead>
                <tr>
                    <th className={"width-200"}>Instrument</th>
                    <th className={"width-200"}>Description</th>
                    <th className={"width-200"}>Investment Proportion</th>
                </tr>
                </thead>
                <tbody>
                {
                    rowItemsList.map((item, index) => <Row index={index} key={index}/>)
                }
                </tbody>
            </table>

            <div>
                <Button onClick={() => {onSubmit(rowItemsList)}} >Submit</Button>
            </div>
        </div>
    )
}

export default function Homepage() {
    const [loading, setLoading] = useState(true);

    const history = useNavigate();

    useEffect(() => {
        getInstruments();
    });

    const getInstruments = (ids, proportions) => {
        const options = {
            method: 'GET',
            url: 'api/instruments',
        };

        axios.request(options).then(function (response) {
            for (const i of response.data) {
                instruments.set(i.id, i);
            }
            setLoading(false);
        }).catch(function (error) {
            console.error(error);
        });
    }

    const navigateToChart = (ids, proportions) => {
        history('/chart', {
            state: {
                ids: ids,
                proportion: proportions
            }
        })
    }

    return (
        <LoadingOverlay active={loading}
                        spinner
                        text='Loading your content...'
        >
            <div style={{padding: "1rem 0", minHeight: '100vh'}}>
                <Table onSubmit={(data) => {
                    navigateToChart(data.map((item) => item.instrument_id), data.map((item) => parseFloat(item.proportion) / 100));
                }}/>
            </div>
        </LoadingOverlay>
    );
}