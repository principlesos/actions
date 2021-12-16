# OVPN connection

This GitHub Action intakes an ovpn config file, credentials and the expected IP of that VPN. It installs the ovpn cli, connects to it and runs a loop to confirm connectivity. All 3 values should be accessible as secrets, especially the first two.

Implementation draws heavily from [this guide](https://grrr.tech/posts/2021/github-actions-openvpn/), but doesnt disaggregate keys from the file itself.

If you need to generate a new ovpn config from a viscosity connection. [This is a helpful gist](https://gist.github.com/vinicius795/e975688fa8ffcba549d8240ecf0a7f9f)

## General

### Usage

```yml
- uses: principlesos/actions/ovpn-connection@v1.5.0
  with:
    ovpn-config: ${{ secrets.VPN_CONFIG }}
    vpn-creds: ${{ secrets.VPN_CREDS }}
    vpn-ip: ${{ secrets.VPN_IP }}
```

### Cleanup

It is good practice to kill the vpn connection after you are done with necessary operations.
You can use a step like the below to kill the connection and retain log access

```yml
- name: Kill VPN connection
  if: always()
  run: |
    sudo chmod 777 vpn.log
    sudo killall openvpn
```
