# WSL2 上で動く開発サーバー (Next.js, デフォルト port 3000) を
# 同じ LAN 上のスマホ等から見えるようにするための portproxy / ファイアウォール設定。
#
# WSL2 の IP アドレスは再起動のたびに変わるため、WSL を再起動した後は
# このスクリプトを再実行して portproxy を張り直す必要がある。
#
# 管理者権限の PowerShell で実行すること。
param(
    [int]$Port = 3000
)

$logPath = "$env:TEMP\expose-dev-server.log"
$ErrorActionPreference = "Stop"

try {
    $wslIpRaw = (wsl hostname -I)
    $wslIp = ($wslIpRaw -split "\s+")[0]
    if (-not $wslIp) {
        throw "WSL の IP アドレスを取得できませんでした。WSL が起動しているか確認してください。"
    }

    netsh interface portproxy delete v4tov4 listenport=$Port listenaddress=0.0.0.0 | Out-Null
    netsh interface portproxy add v4tov4 listenport=$Port listenaddress=0.0.0.0 connectport=$Port connectaddress=$wslIp | Out-Null

    $ruleName = "WSL2 Dev Server $Port"
    if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
    }

    $lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL" -and $_.IPAddress -notlike "169.254.*" } |
        Select-Object -First 1).IPAddress

    $result = @"
WSL_IP=$wslIp
LAN_IP=$lanIp
URL=http://${lanIp}:${Port}
"@
    Write-Output $result
    $result | Out-File -FilePath $logPath -Encoding utf8
}
catch {
    "ERROR=$($_ | Out-String)" | Out-File -FilePath $logPath -Encoding utf8
}
