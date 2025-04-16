enum requestType{
    NEWCHAT,
    NEWUSER,
    NEWANO,
}

interface DatabaseRequest {
    type: requestType;
    username?: string;
    password?: string;
}

async function createAno(){
    const request: DatabaseRequest = {
        type: requestType.NEWANO,
        username: "Wawo",
    }

    await fetch("http://localhost:8080/database", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
          },
        body: JSON.stringify(request),
    });
}

function DatabaseTest() {
    return (
    <>
        <div><button onClick={createAno}>Create Anonymous User</button></div>
        <div id="please"></div>
    </>
)
}export default DatabaseTest