import {Button, Container, Form, Table, Row, Col, Badge, Overlay, Tooltip} from 'react-bootstrap';
import './homepage.css';
import {useEffect, useRef, useState} from "react";
import axios from "axios";
import {useNavigate} from "react-router";
import LoadingOverlay from 'react-loading-overlay';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import {PropagateLoader} from "react-spinners";


const instruments = new Map();

const options = () => {
    let select_options = [];
    instruments.forEach((instrument, index) => {
        select_options.push(<option key={index} value={instrument.id}>{instrument.name}</option>)
    });
    return select_options;
}

const Get_First_Instrument_ID = () => {
    return instruments[Symbol.iterator]().next().value[0];
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
                {instruments.get(instrument_id).desc}
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
    const proportionWarningTarget = useRef(null);
    const [showProportionWarning, setShowProportionWarning] = useState(false);

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

    const getTotalProportion = () => {
        if (elementsProp.length === 0) return 0;
        let total = 0;
        elementsProp.forEach(item => {
            total = total + parseInt(item.proportion);
        })
        return total;
    }

    return (
        <div>
            <Row>
                <Table className={"text-center"}>
                    <thead>
                    <tr>
                        <th className={"width-200"}>Instrument</th>
                        <th className={"width-200"}>Description</th>
                        <th className={"width-200"}>Investment Proportion (%)
                            <Badge className={(getTotalProportion() === 100)?"proportion-badge-complete":"proportion-badge-incomplete"} ref={proportionWarningTarget} >
                                {getTotalProportion()}/100
                            </Badge>

                            <Overlay target={proportionWarningTarget.current} show={showProportionWarning && (getTotalProportion() !== 100)} placement="top">
                                {(props) => (
                                    <Tooltip className="warning-overlay" {...props}>
                                        This should add up to 100.
                                    </Tooltip>
                                )}
                            </Overlay>
                        </th>
                    </tr>
                    </thead>
                    <tbody>
                    {
                        new Array(numberOfElements).fill(0).map((item, index) => <TableRow key={index}
                                                                                           updateHandler={(newObj) => {
                                                                                               onElementUpdate(index, newObj)
                                                                                           }}/>)
                    }
                    </tbody>
                </Table>
            </Row>

            <Row className={"justify-content-md-center"}>
                <Button variant="secondary" onClick={onAddItem} className={"add-item-button"}>
                    &#x2B; Add Item
                </Button>

                <Button onClick={() => {
                    if (getTotalProportion() === 100){
                        onSubmit(elementsProp);
                    } else {
                        setShowProportionWarning(true);
                    }
                }} className={"submit-btn"}>
                    Submit
                </Button>
            </Row>

        </div>
    )
}

export default function Homepage() {
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());

    const history = useNavigate();

    useEffect(() => {
        getInstruments();
    }, []);

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
                proportion: proportions,
                start_timestamp: +startDate,
                end_timestamp: +endDate
            }
        })
    }

    return (
        <LoadingOverlay active={loading}
                        spinner={<PropagateLoader color={"#36D7B7"}/>}
        >
            <Container style={{padding: "1rem 0", minHeight: '100vh'}}>
                <Row>
                    <Row className={"pt-2"}>
                        <Col className={"display-flex-center"}>
                            <p className={"date-label"}>Start Date: </p>
                            <div className={"width-200"}>
                                <DatePicker selected={startDate} onChange={(date) => setStartDate(date)}/>
                            </div>
                        </Col>

                        <Col className={"display-flex-center"}>
                            <p className={"date-label"}>End Date: </p>
                            <div className={"width-200"}>
                                <DatePicker selected={endDate} onChange={(date) => setEndDate(date)}/>
                            </div>
                        </Col>
                    </Row>

                    <div>
                        <TableInput onSubmit={(data) => {
                            navigateToChart(data.map((item) => item.instrument_id), data.map((item) => parseFloat(item.proportion) / 100));
                        }}/>
                    </div>
                </Row>
            </Container>
        </LoadingOverlay>
    );
}