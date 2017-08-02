import {Request} from 'express';
import {getParameters, Parameter} from "../../common/Parameter";

export function Data<Function>(): ParameterDecorator {
    return (target: Object, method: string, index: number) => {
        let parameters = getParameters(target);
        if (!parameters[method]) {
            parameters[method] = [];
        }

        parameters[method].push(new DataParameter(null, index));
    };
}

export class DataParameter implements Parameter {

    constructor(public name: string,
                public index: Number) {
    }

    public getValue(req: Request) {
        return req.body;
    }
}