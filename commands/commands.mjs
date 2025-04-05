export const commands = {};

export const addCommand = (name, description, executeFunction) => {
    commands[name] = {
        description,
        execute: executeFunction,
    };
};
