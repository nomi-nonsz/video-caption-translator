import { getPassword, setPassword } from "keytar";

const SERVICE = 'SAMESAMEAA'

async function test() {
  // await setPassword(SERVICE, 'passwd', 'skibidi123');
  const passwd = await getPassword(SERVICE, 'passwd');

  console.log(passwd);
}

test();