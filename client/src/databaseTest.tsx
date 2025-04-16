interface DatabaseRequest {
    username?: string;
    password?: string;
}

async function createAno(){

    const response = await fetch("http://localhost:8080/database/newano", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
          }
    });
    const data = await response.json();
    if(data.success){
        console.log(data);
        document.getElementById("please")!.innerText = `New User added: ${data.id}`;
    }
}

async function createUser(){

    const userData: DatabaseRequest = {
        username: "wawo",
        password: "1234",    
    }

    const response = await fetch("http://localhost:8080/database/newuser", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
          },
        body: JSON.stringify(userData),
    });
    const data = await response.json();
    if(data.success){
        console.log(data);
        document.getElementById("wawo")!.innerText = `New User added: ${data.id}`;
    }
}

function DatabaseTest() {
    return (
    <>
        <div><button onClick={createAno}>Create Anonymous User</button></div>
        <div id="please"></div>
        <div><button onClick={createUser}>Create User</button></div>
        <div id="wawo"></div>
    </>
)
}export default DatabaseTest