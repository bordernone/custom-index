import {Button, Container, Form, Table, Row} from 'react-bootstrap';
import './homepage.css';
import {useEffect, useState} from "react";
import axios from "axios";
import { useNavigate } from "react-router";
import LoadingOverlay from 'react-loading-overlay';

const instruments = new Map();

const options = () => {
    let select_options = [];
    instruments.forEach((instrument, index) => {
        select_options.push(<option key={index} value={instrument.id}>{instrument.name}</option>)
    });
    return select_options;
}

const Get_First_Instrument_ID = () => {
    return "2000";
}

const TableRow = ({updateHandler}) => {
    const [proportion, setProportion] = useState(0);
    const [instrument_id, setInstrument_id] = useState(Get_First_Instrument_ID());

    const handleProportionChange = (e) => {
        setProportion(e.target.value);
        updateHandler({
            proportion: e.target.value,
            instrument_id: instrument_id
        })
    }

    const handleSelectChange = (e) => {
        setInstrument_id(e.target.value);
        updateHandler({
            proportion: proportion,
            instrument_id: e.target.value
        })
    }

    return (
        <tr>
            <td>
                <Form.Select value={instrument_id} onChange={handleSelectChange}>
                    {options().map((data) => data)}
                </Form.Select>
            </td>
            <td className={"table-text-center"}>
                {"Cool"}
            </td>
            <td>
                <Form.Control
                    type="number"
                    value={proportion}
                    onChange={handleProportionChange}
                />
            </td>
        </tr>
    )
}

function TableInput({onSubmit}) {
    const [elementsProp, setElementsProp] = useState([]);
    const [numberOfElements, setNumberOfElements] = useState(0);

    const onElementUpdate = (rowIndex, newObj) => {
        let elemProps = [...elementsProp];
        elemProps[rowIndex] = newObj;
        setElementsProp(elemProps);
    }

    const onAddItem = () => {
        onElementUpdate(numberOfElements, {
            proportion: 0,
            instrument_id: Get_First_Instrument_ID()
        })
        setNumberOfElements(numberOfElements + 1);
    }

    return (
        <div>
            <Row>
                <Table className={"text-center"}>
                    <thead>
                    <tr>
                        <th className={"width-200"}>Instrument</th>
                        <th className={"width-200"}>Description</th>
                        <th className={"width-200"}>Investment Proportion</th>
                    </tr>
                    </thead>
                    <tbody>
                    {
                        new Array(numberOfElements).fill(0).map((item, index) => <TableRow key={index} updateHandler={(newObj) => {onElementUpdate(index, newObj)}}/>)
                    }
                    </tbody>
                </Table>
            </Row>

            <Row className={"justify-content-md-center"}>
                    <Button variant="secondary" onClick={onAddItem} className={"add-item-button"}>
                        &#x2B; Add Item
                    </Button>

                    <Button onClick={() => {onSubmit(elementsProp)}} >
                        Submit
                    </Button>
            </Row>

        </div>
    )
}

export default function Homepage() {
    const [loading, setLoading] = useState(true);

    const history = useNavigate();

    useEffect(() => {
        getInstruments();
    });

    const getInstruments = () => {
        const options = {
            method: 'GET',
            url: 'api/instruments',
        };

        axios.request(options).then(function (response) {
            let temp = [...response.data];
            temp.sort(function (first, second) {
                return ('' + first.name).localeCompare(second.name);
            })
            for (const i of temp) {
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
                        text='Loading...'
        >
            <Container>
                <div style={{padding: "1rem 0", minHeight: '100vh'}}>
                    <TableInput onSubmit={(data) => {
                        navigateToChart(data.map((item) => item.instrument_id), data.map((item) => parseFloat(item.proportion) / 100));
                    }}/>
                </div>
            </Container>
        </LoadingOverlay>
    );
}