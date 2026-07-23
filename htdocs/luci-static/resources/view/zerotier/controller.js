/* SPDX-License-Identifier: Apache-2.0 */

'use strict';
'require view';
'require rpc';

/* Embedded ZeroTier Controller management view for ImmortalWrt/OpenWrt LuCI */

var callStatus = rpc.declare({
	object: 'zerotier-controller',
	method: 'status'
});

var callListNetworks = rpc.declare({
	object: 'zerotier-controller',
	method: 'list_networks'
});

var callGetNetworkInfo = rpc.declare({
	object: 'zerotier-controller',
	method: 'get_network_info',
	params: [ 'nwid' ]
});

var callCreateNetwork = rpc.declare({
	object: 'zerotier-controller',
	method: 'create_network',
	params: [ 'name' ]
});

var callUpdateIPPool = rpc.declare({
	object: 'zerotier-controller',
	method: 'update_ip_pool',
	params: [ 'nwid', 'cidr', 'old_cidr' ]
});

var callListMembers = rpc.declare({
	object: 'zerotier-controller',
	method: 'list_members',
	params: [ 'nwid' ]
});

var callAuthorizeMember = rpc.declare({
	object: 'zerotier-controller',
	method: 'authorize_member',
	params: [ 'nwid', 'nodeid', 'authorized' ]
});

var callChangeMemberIP = rpc.declare({
	object: 'zerotier-controller',
	method: 'change_member_ip',
	params: [ 'nwid', 'nodeid', 'ip_assignments' ]
});

var callRenameMember = rpc.declare({
	object: 'zerotier-controller',
	method: 'rename_member',
	params: [ 'nwid', 'nodeid', 'name' ]
});

var callAddRoute = rpc.declare({
	object: 'zerotier-controller',
	method: 'add_route',
	params: [ 'nwid', 'target', 'via' ]
});

var callDelRoute = rpc.declare({
	object: 'zerotier-controller',
	method: 'del_route',
	params: [ 'nwid', 'target' ]
});

var callDeleteMember = rpc.declare({
	object: 'zerotier-controller',
	method: 'delete_member',
	params: [ 'nwid', 'nodeid' ]
});

var callExportBackup = rpc.declare({
	object: 'zerotier-controller',
	method: 'export_backup',
	params: [ 'nwid' ]
});

var callImportBackup = rpc.declare({
	object: 'zerotier-controller',
	method: 'import_backup',
	params: [ 'backup_data' ]
});

function rpcErrorMessage(res) {
	if (!res)
		return _('Empty response from controller service');

	var message = res.error || res.controllerError || _('Controller request failed');
	var httpStatus = res.http_status || res.controllerHttpStatus;
	if (httpStatus)
		message += ' (HTTP ' + httpStatus + ')';

	return message;
}

function requireRpcResult(res) {
	if (!res || res.error)
		throw new Error(rpcErrorMessage(res));

	return res;
}


function peerConnectionInfo(peer, now) {
	var paths = Array.isArray(peer && peer.paths) ? peer.paths : [];
	var activePaths = paths.filter(function(path) {
		return path && path.active === true;
	});
	var timestamps = [ Number(peer && peer.lastReceive) || 0, Number(peer && peer.lastSend) || 0 ];
	paths.forEach(function(path) {
		timestamps.push(Number(path && path.lastReceive) || 0, Number(path && path.lastSend) || 0);
	});
	var lastActivity = Math.max.apply(Math, timestamps);
	var latency = Number(peer && peer.latency);
	if (!isFinite(latency) || latency < 0)
		latency = -1;

	var direct = activePaths.length > 0;
	var online = direct || latency >= 0 || lastActivity > (now - 120000);

	return {
		online: online,
		mode: direct ? 'direct' : 'relay',
		latency: latency
	};
}

function showNotification(message, type) {
	var host = document.getElementById('ztc-notifications');
	if (!host) {
		window.alert(message);
		return;
	}

	var toast = E('div', {
		'class': 'ztc-toast ztc-toast-' + (type || 'info'),
		'role': 'status'
	}, [
		E('span', {}, [ message ]),
		E('button', {
			'class': 'ztc-toast-close',
			'type': 'button',
			'title': _('Dismiss'),
			'click': function() { toast.remove(); }
		}, [ '\u00d7' ])
	]);

	host.appendChild(toast);
	window.setTimeout(function() {
		if (toast.parentNode)
			toast.parentNode.removeChild(toast);
	}, 5000);
}

function handleRpcError(err) {
	showNotification(_('Operation failed: ') + ((err && err.message) ? err.message : String(err)), 'error');
}

function ipv4FromNumber(value) {
	return [
		Math.floor(value / 16777216) % 256,
		Math.floor(value / 65536) % 256,
		Math.floor(value / 256) % 256,
		value % 256
	].join('.');
}

function ipv4ToNumber(value) {
	var match = String(value || '').match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (!match)
		return null;
	var octets = match.slice(1).map(Number);
	if (octets.some(function(octet) { return octet < 0 || octet > 255; }))
		return null;
	return octets[0] * 16777216 + octets[1] * 65536 + octets[2] * 256 + octets[3];
}

function parseIPv4CIDR(value) {
	var match = String(value || '').trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
	if (!match)
		return null;

	var octets = match.slice(1, 5).map(Number);
	var prefix = Number(match[5]);
	if (octets.some(function(octet) { return octet < 0 || octet > 255; }) || prefix < 8 || prefix > 30)
		return null;

	var address = octets[0] * 16777216 + octets[1] * 65536 + octets[2] * 256 + octets[3];
	var blockSize = Math.pow(2, 32 - prefix);
	var network = Math.floor(address / blockSize) * blockSize;
	var broadcast = network + blockSize - 1;

	return {
		cidr: ipv4FromNumber(network) + '/' + prefix,
		start: ipv4FromNumber(network + 1),
		end: ipv4FromNumber(broadcast - 1),
		networkNumber: network,
		broadcastNumber: broadcast
	};
}

function dashboardStyles() {
	return [
		'.ztc-dashboard { --ztc-accent:var(--primary-color, #2563eb); --ztc-success:#16a34a; --ztc-danger:#dc2626; --ztc-warning:#d97706; --ztc-radius:12px; font-variant-numeric:tabular-nums; }',
		'.ztc-dashboard .ztc-hero { display:flex; align-items:center; justify-content:space-between; gap:20px; margin:0 0 16px; padding:20px 22px; overflow:hidden; border-radius:16px; color:#fff; background:linear-gradient(135deg, #172554 0%, #1d4ed8 58%, #0891b2 100%); box-shadow:0 12px 30px rgba(30,64,175,.18); }',
		'.ztc-dashboard .ztc-hero-main { display:flex; align-items:center; gap:15px; min-width:0; }',
		'.ztc-dashboard .ztc-brandmark { display:grid; place-items:center; flex:0 0 46px; width:46px; height:46px; border:1px solid rgba(255,255,255,.35); border-radius:13px; background:rgba(255,255,255,.14); font-size:17px; font-weight:800; letter-spacing:.06em; backdrop-filter:blur(8px); }',
		'.ztc-dashboard .ztc-hero h2 { margin:0 0 3px; padding:0; border:0; color:#fff; font-size:clamp(20px, 2.5vw, 28px); }',
		'.ztc-dashboard .ztc-hero p { margin:0; color:rgba(255,255,255,.82); line-height:1.45; }',
		'.ztc-dashboard .ztc-count { flex:0 0 auto; padding:7px 12px; border:1px solid rgba(255,255,255,.28); border-radius:999px; background:rgba(255,255,255,.12); font-weight:600; white-space:nowrap; }',
		'.ztc-dashboard .ztc-card { margin:0 0 15px; padding:16px 17px; border:1px solid var(--border-color-medium, rgba(100,116,139,.22)); border-radius:var(--ztc-radius); background:var(--background-color-high, rgba(255,255,255,.98)); box-shadow:0 5px 18px rgba(15,23,42,.05); }',
		'.ztc-dashboard .ztc-card h3 { margin:0 0 13px; padding:0; border:0; font-size:16px; }',
		'.ztc-dashboard .ztc-heading-reset { margin:0 !important; }',
		'.ztc-dashboard .ztc-subtitle { display:block; margin-top:5px; color:var(--text-color-medium, #64748b); font-size:12px; line-height:1.45; }',
		'.ztc-dashboard .ztc-status-card { display:flex; align-items:center; justify-content:space-between; gap:18px; border-left:4px solid var(--ztc-accent); }',
		'.ztc-dashboard .ztc-eyebrow { display:block; margin-bottom:5px; color:var(--text-color-medium, #64748b); font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }',
		'.ztc-dashboard .ztc-code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }',
		'.ztc-dashboard .ztc-node-id { font-size:17px; overflow-wrap:anywhere; }',
		'.ztc-dashboard .ztc-version { margin-left:8px; color:var(--text-color-medium, #64748b); font-size:12px; }',
		'.ztc-dashboard .ztc-status-pills { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; }',
		'.ztc-dashboard .ztc-pill { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; color:#fff; font-size:12px; font-weight:700; white-space:nowrap; }',
		'.ztc-dashboard .ztc-pill::before { content:""; width:7px; height:7px; border-radius:50%; background:currentColor; box-shadow:0 0 0 3px rgba(255,255,255,.18); }',
		'.ztc-dashboard .ztc-pill-success { background:var(--ztc-success); }',
		'.ztc-dashboard .ztc-pill-danger { background:var(--ztc-danger); }',
		'.ztc-dashboard .ztc-pill-warning { background:var(--ztc-warning); }',
		'.ztc-dashboard .ztc-error { margin:10px 0 0; padding:9px 11px; border-radius:8px; color:#991b1b; background:rgba(254,226,226,.86); font-size:13px; }',
		'.ztc-dashboard .ztc-layout { display:grid; grid-template-columns:minmax(230px, 286px) minmax(0, 1fr); gap:16px; align-items:start; }',
		'.ztc-dashboard .ztc-sidebar { position:sticky; top:12px; }',
		'.ztc-dashboard .ztc-network-list { display:grid; gap:8px; margin:0; padding:0; list-style:none; }',
		'.ztc-dashboard .ztc-network-button { width:100%; padding:9px 11px; overflow:hidden; border:1px solid rgba(37,99,235,.20); border-radius:8px; text-align:left; text-overflow:ellipsis; white-space:nowrap; }',
		'.ztc-dashboard .ztc-network-button.is-active { border-color:var(--ztc-accent); color:#fff; background:var(--ztc-accent); box-shadow:0 5px 14px rgba(37,99,235,.22); }',
		'.ztc-dashboard .ztc-empty { display:grid; min-height:140px; place-items:center; padding:22px; border:1px dashed var(--border-color-medium, #cbd5e1); border-radius:var(--ztc-radius); color:var(--text-color-medium, #64748b); text-align:center; }',
		'.ztc-dashboard .ztc-empty-small { min-height:64px; padding:13px; }',
		'.ztc-dashboard .ztc-field { margin:0 0 10px; padding:0; }',
		'.ztc-dashboard .ztc-full { box-sizing:border-box; width:100%; max-width:none; }',
		'.ztc-dashboard .ztc-stack-input { margin-bottom:8px; }',
		'.ztc-dashboard input[type="text"], .ztc-dashboard input[type="file"], .ztc-dashboard select { box-sizing:border-box; max-width:none; border-radius:7px; }',
		'.ztc-dashboard .ztc-card button, .ztc-dashboard .ztc-card .btn { min-height:34px; border-radius:7px; }',
		'.ztc-dashboard button[disabled] { cursor:not-allowed; opacity:.55; }',
		'.ztc-dashboard .ztc-overview { display:flex; align-items:center; justify-content:space-between; gap:14px; }',
		'.ztc-dashboard .ztc-card-heading { margin-bottom:13px; }',
		'.ztc-dashboard .ztc-actions { display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:8px; }',
		'.ztc-dashboard .ztc-filterbar { display:grid; grid-template-columns:minmax(200px, .55fr) minmax(300px, 1.45fr); gap:12px; margin-bottom:13px; padding:10px; border-radius:9px; background:rgba(100,116,139,.08); }',
		'.ztc-dashboard .ztc-filterfield { display:flex; align-items:center; gap:7px; min-width:0; }',
		'.ztc-dashboard .ztc-filterfield label { flex:0 0 auto; }',
		'.ztc-dashboard .ztc-filterfield select, .ztc-dashboard .ztc-filterfield input { min-width:0; }',
		'.ztc-dashboard .ztc-filterfield-grow { min-width:0; }',
		'.ztc-dashboard .ztc-table-wrap { max-height:520px; overflow:auto; border:1px solid var(--border-color-medium, #dbe2ea); border-radius:9px; }',
		'.ztc-dashboard .ztc-table-wrap table { margin:0; }',
		'.ztc-dashboard .ztc-table-wrap thead th { position:sticky; top:0; z-index:1; background:var(--background-color-high, #fff); white-space:nowrap; }',
		'.ztc-dashboard .ztc-table-wrap tbody tr:hover { background:rgba(37,99,235,.045); }',
		'.ztc-dashboard .ztc-members-table { width:100%; min-width:760px; table-layout:fixed; }',
		'.ztc-dashboard .ztc-members-table th, .ztc-dashboard .ztc-members-table td { box-sizing:border-box; vertical-align:middle; }',
		'.ztc-dashboard .ztc-members-table th:nth-child(1) { width:12%; }',
		'.ztc-dashboard .ztc-members-table th:nth-child(2) { width:19%; }',
		'.ztc-dashboard .ztc-members-table th:nth-child(3) { width:18%; }',
		'.ztc-dashboard .ztc-members-table th:nth-child(4) { width:14%; }',
		'.ztc-dashboard .ztc-members-table th:nth-child(5) { width:11%; }',
		'.ztc-dashboard .ztc-members-table th:nth-child(6) { width:26%; }',
		'.ztc-dashboard .ztc-members-table input { box-sizing:border-box; width:100%; min-width:0; max-width:none; }',
		'.ztc-dashboard .ztc-table-sort { cursor:pointer; user-select:none; }',
		'.ztc-dashboard .ztc-table-sort::after { content:"↕"; margin-left:5px; color:var(--text-color-medium, #64748b); font-size:10px; opacity:.65; }',
		'.ztc-dashboard .ztc-member-id { overflow:hidden; font-weight:700; text-overflow:ellipsis; white-space:nowrap; }',
		'.ztc-dashboard .ztc-connection { display:flex; flex-direction:column; align-items:flex-start; gap:3px; min-width:0; }',
		'.ztc-dashboard .ztc-link-mode, .ztc-dashboard .ztc-auth-badge { display:inline-flex; align-items:center; justify-content:center; min-width:58px; padding:3px 7px; border-radius:999px; font-size:10px; font-weight:800; letter-spacing:.04em; line-height:1.25; white-space:nowrap; }',
		'.ztc-dashboard .ztc-link-mode::before { content:""; width:6px; height:6px; margin-right:5px; border-radius:50%; background:currentColor; }',
		'.ztc-dashboard .ztc-link-direct { color:#047857; background:rgba(16,185,129,.14); }',
		'.ztc-dashboard .ztc-link-relay { color:#b45309; background:rgba(245,158,11,.16); }',
		'.ztc-dashboard .ztc-link-local { color:#1d4ed8; background:rgba(59,130,246,.14); }',
		'.ztc-dashboard .ztc-link-offline { color:#64748b; background:rgba(100,116,139,.14); }',
		'.ztc-dashboard .ztc-latency { color:var(--text-color-medium, #64748b); font-size:11px; white-space:nowrap; }',
		'.ztc-dashboard .ztc-auth-authorized { color:#fff; background:var(--ztc-success); }',
		'.ztc-dashboard .ztc-auth-pending { color:#fff; background:#f59e0b; }',
		'.ztc-dashboard .ztc-member-actions { display:flex; flex-wrap:nowrap; gap:5px; white-space:nowrap; }',
		'.ztc-dashboard .ztc-member-actions .btn { flex:1 1 auto; min-width:0; padding-left:8px; padding-right:8px; }',
		'.ztc-dashboard .ztc-form-row { display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; }',
		'.ztc-dashboard .ztc-form-field { flex:1 1 210px; min-width:0; }',
		'.ztc-dashboard .ztc-form-field label { display:block; margin-bottom:6px; font-weight:600; }',
		'.ztc-dashboard .ztc-help { margin:7px 0 0; color:var(--text-color-medium, #64748b); font-size:12px; line-height:1.5; }',
		'.ztc-dashboard .ztc-pool-preview { display:flex; flex-wrap:wrap; gap:8px 16px; margin-top:12px; padding:10px 12px; border-radius:8px; background:rgba(37,99,235,.07); font-size:12px; }',
		'.ztc-dashboard .ztc-pool-preview strong { font-weight:700; }',
		'.ztc-dashboard .ztc-route-table { width:100%; margin:0 0 14px; table-layout:fixed; }',
		'.ztc-dashboard .ztc-route-table th, .ztc-dashboard .ztc-route-table td { vertical-align:middle; }',
		'.ztc-dashboard .ztc-route-table th:last-child, .ztc-dashboard .ztc-route-table td:last-child { width:124px; text-align:right; }',
		'.ztc-dashboard .ztc-route-table .btn { width:116px; }',
		'.ztc-dashboard .ztc-route-form { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr) 124px; gap:12px; align-items:end; }',
		'.ztc-dashboard .ztc-route-form .ztc-form-field { min-width:0; }',
		'.ztc-dashboard .ztc-route-form > .btn { width:100%; }',
		'.ztc-toast-stack { position:fixed; z-index:10000; top:18px; right:18px; display:grid; gap:10px; width:min(390px, calc(100vw - 36px)); pointer-events:none; }',
		'.ztc-toast { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; padding:13px 14px; border-left:4px solid #2563eb; border-radius:10px; color:#0f172a; background:#fff; box-shadow:0 14px 35px rgba(15,23,42,.22); pointer-events:auto; }',
		'.ztc-toast-success { border-left-color:var(--ztc-success); }',
		'.ztc-toast-warning { border-left-color:var(--ztc-warning); }',
		'.ztc-toast-error { border-left-color:var(--ztc-danger); }',
		'.ztc-toast-close { min-height:0 !important; padding:0 2px; border:0; color:#64748b; background:transparent; font-size:20px; line-height:1; cursor:pointer; }',
		'@media (max-width: 900px) { .ztc-dashboard .ztc-layout { grid-template-columns:1fr; } .ztc-dashboard .ztc-sidebar { position:static; } .ztc-dashboard .ztc-status-card, .ztc-dashboard .ztc-overview { align-items:flex-start; flex-direction:column; } .ztc-dashboard .ztc-status-pills, .ztc-dashboard .ztc-actions { justify-content:flex-start; } }',
		'@media (max-width: 720px) { .ztc-dashboard .ztc-filterbar { grid-template-columns:1fr; } .ztc-dashboard .ztc-route-form { grid-template-columns:1fr; } .ztc-dashboard .ztc-route-form > .btn { width:100%; } }',
		'@media (max-width: 560px) { .ztc-dashboard .ztc-hero { align-items:flex-start; padding:18px; } .ztc-dashboard .ztc-brandmark, .ztc-dashboard .ztc-count { display:none; } .ztc-dashboard .ztc-card { padding:14px; } .ztc-dashboard .ztc-form-row > button { width:100%; } .ztc-dashboard .ztc-filterfield { align-items:stretch; flex-direction:column; gap:5px; } }'
	].join('
');
}

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return Promise.all([
			callStatus().catch(function(err) {
				return { online: false, controller: false, error: err.message || String(err) };
			}),
			callListNetworks().catch(function(err) {
				return { networks: [], error: err.message || String(err) };
			})
		]);
	},

	render: function(data) {
		var status = data[0] || {};
		var networksData = data[1] || {};
		
		var controllerReady = status.controller === true && status.databaseReady !== false;
		var controllerProblem = (status.error || status.controllerError) ? rpcErrorMessage(status) :
			(networksData.error ? rpcErrorMessage(networksData) : null);
		if (status.controllerHttpStatus === 404)
			controllerProblem = _('This ZeroTier build does not include the embedded Controller API.') + ' (HTTP 404)';
		var networks = [];
		if (Array.isArray(networksData)) {
			networks = networksData;
		} else if (networksData && Array.isArray(networksData.networks)) {
			networks = networksData.networks;
		}
		networks = networks.map(function(network) {
			return (typeof network === 'string') ? network : (network.id || network.nwid || '');
		}).filter(function(nwid) {
			return /^[0-9a-f]{16}$/i.test(nwid);
		});
		var activeNwid = networks.length > 0 ? networks[0] : null;

		var viewContainer = E('div', { 'class': 'cbi-map ztc-dashboard' }, [
			E('style', {}, [ dashboardStyles() ]),
			E('div', { 'id': 'ztc-notifications', 'class': 'ztc-toast-stack', 'aria-live': 'polite' }),
			E('div', { 'class': 'ztc-hero' }, [
				E('div', { 'class': 'ztc-hero-main' }, [
					E('div', { 'class': 'ztc-brandmark', 'aria-hidden': 'true' }, [ 'ZT' ]),
					E('div', {}, [
						E('h2', {}, [ _('ZeroTier Controller') ]),
						E('p', {}, [ _('Self-hosted network, member and route management for this router.') ])
					])
				]),
				E('span', { 'class': 'ztc-count' }, [ networks.length, ' ', networks.length === 1 ? _('network') : _('networks') ])
			]),

			// Controller Status Card
			E('div', { 'class': 'cbi-section ztc-card ztc-status-card' }, [
				E('div', {}, [
					E('span', { 'class': 'ztc-eyebrow' }, [ _('Controller node') ]),
					E('strong', { 'class': 'ztc-node-id ztc-code' }, [ status.address || _('Unavailable') ]),
					E('span', { 'class': 'ztc-version' }, [
						status.version ? 'v' + status.version : ''
					]),
					controllerProblem ? E('p', { 'class': 'ztc-error' }, [ controllerProblem ]) : ''
				]),
				E('div', { 'class': 'ztc-status-pills' }, [
					E('span', { 'class': 'ztc-pill ' + (status.online === true ? 'ztc-pill-success' : 'ztc-pill-warning') }, [
						status.online === true ? _('Node Online') : _('Node Offline')
					]),
					E('span', { 'class': 'ztc-pill ' + (controllerReady ? 'ztc-pill-success' : 'ztc-pill-danger') }, [
						controllerReady ? _('Controller Active') : _('Controller Unavailable')
					])
				])
			]),

			// Main Dashboard Layout Grid
			E('div', { 'class': 'ztc-layout' }, [
				// Sidebar
				E('aside', { 'class': 'ztc-sidebar' }, [
					// Network List Card
					E('div', { 'class': 'cbi-section ztc-card' }, [
						E('h3', {}, [ _('Managed Networks') ]),
						E('div', { 'id': 'network-list-box' }, [
							networks.length === 0 ? E('p', { 'class': 'ztc-empty ztc-empty-small' }, [ _('No networks created yet.') ]) : E('ul', { 'class': 'ztc-network-list' },
								networks.map(function(nwid) {
									var self = this;
									return E('li', {}, [
										E('button', {
											'class': 'btn cbi-button-action ztc-network-button ztc-code' + (nwid === activeNwid ? ' is-active' : ''),
											'data-nwid': nwid,
											'click': function(ev) {
												ev.preventDefault();
												self.loadNetworkDetails(nwid);
											}
										}, [ nwid ])
									]);
								}.bind(this))
							)
						])
					]),

					// Create Network Card
					E('div', { 'class': 'cbi-section ztc-card' }, [
						E('h3', {}, [ _('Create Network') ]),
						E('div', { 'class': 'cbi-value ztc-field' }, [
							E('input', { 'type': 'text', 'id': 'new-net-name', 'class': 'ztc-full ztc-stack-input', 'placeholder': _('Network Name') }),
							E('button', {
								'class': 'btn cbi-button-save ztc-full',
								'disabled': controllerReady ? null : 'disabled',
								'click': function(ev) {
									ev.preventDefault();
									var name = document.getElementById('new-net-name').value || 'new_network';
									return callCreateNetwork(name).then(requireRpcResult).then(function(res) {
										var nwid = res.nwid || res.id;
										if (!nwid)
											throw new Error(_('Controller did not return a network ID'));
										showNotification(_('Created network: ') + nwid, 'success');
										window.setTimeout(function() { window.location.reload(); }, 700);
									}).catch(handleRpcError);
								}
							}, [ _('Create New Network') ])
						])
					]),

					// Import Backup Card
					E('div', { 'class': 'cbi-section ztc-card' }, [
						E('h3', {}, [ _('Import JSON Backup') ]),
						E('div', { 'class': 'cbi-value ztc-field' }, [
							E('input', { 'type': 'file', 'id': 'backup-file-input', 'class': 'ztc-full ztc-stack-input', 'accept': '.json' }),
							E('button', {
								'class': 'btn cbi-button-action ztc-full',
								'disabled': controllerReady ? null : 'disabled',
								'click': function(ev) {
									ev.preventDefault();
									var fileInput = document.getElementById('backup-file-input');
									if (!fileInput.files || !fileInput.files[0]) {
										showNotification(_('Please select a JSON backup file.'), 'warning');
										return;
									}
									var reader = new FileReader();
									reader.onload = function(e) {
										callImportBackup(e.target.result).then(requireRpcResult).then(function() {
											showNotification(_('Network backup restored successfully.'), 'success');
											window.setTimeout(function() { window.location.reload(); }, 700);
										}).catch(handleRpcError);
									};
									reader.readAsText(fileInput.files[0]);
								}
							}, [ _('Import Backup') ])
						])
					])
				]),

				// Main Content Column
				E('div', { 'id': 'main-network-panel' }, [
					E('div', { 'class': 'ztc-empty' }, [
						E('p', {}, [ _('Select a network from the sidebar to view members and configuration.') ])
					])
				])
			])
		]);

		// Automatically load details of first network if available
		if (activeNwid) {
			setTimeout(function() {
				this.loadNetworkDetails(activeNwid);
			}.bind(this), 100);
		}

		return viewContainer;
	},

	loadNetworkDetails: function(nwid) {
		var panel = document.getElementById('main-network-panel');
		if (!panel) return;
		document.querySelectorAll('.ztc-network-button').forEach(function(button) {
			button.classList.toggle('is-active', button.getAttribute('data-nwid') === nwid);
		});
		panel.innerHTML = '';
		panel.appendChild(E('p', {}, [ _('Loading network details for ') + nwid + '...' ]));

		Promise.all([
			callGetNetworkInfo(nwid),
			callListMembers(nwid)
		]).then(function(res) {
			var netInfo = requireRpcResult(res[0]);
			var membersRes = requireRpcResult(res[1]);
			var membersMap = (membersRes && membersRes.members) ? membersRes.members : {};
			var peersMap = (membersRes && Array.isArray(membersRes.peers)) ? membersRes.peers : [];
			
			// Build one connection record per peer. A reachable peer without an
			// active physical path is connected through a ZeroTier relay.
			var peerConnections = {};
			var now = Date.now();
			peersMap.forEach(function(peer) {
				if (peer && peer.address)
					peerConnections[String(peer.address).toLowerCase()] = peerConnectionInfo(peer, now);
			});

			var membersList = [];
			if (Array.isArray(membersMap)) {
				membersList = membersMap;
			} else if (membersMap && typeof membersMap === 'object') {
				membersList = Object.keys(membersMap).map(function(k) { return membersMap[k]; });
			}

			panel.innerHTML = '';
			panel.appendChild(this.renderDashboardContent(nwid, netInfo, membersList, peerConnections));
			
			// Apply default filter: Online Only
			this.filterMembersTable();
		}.bind(this)).catch(function(err) {
			panel.innerHTML = '';
			panel.appendChild(E('div', { 'class': 'alert-message warning' }, [ rpcErrorMessage({ error: err.message || String(err) }) ]));
		});
	},

	renderDashboardContent: function(nwid, netInfo, members, peerConnections) {
		var self = this;
		var configuredPool = (netInfo.ipAssignmentPools || [])[0] || {};
		var configuredPoolStart = ipv4ToNumber(configuredPool.ipRangeStart);
		var directIPv4Route = (netInfo.routes || []).find(function(route) {
			var parsedRoute = route && !route.via ? parseIPv4CIDR(route.target) : null;
			return parsedRoute && configuredPoolStart !== null &&
				configuredPoolStart >= parsedRoute.networkNumber && configuredPoolStart <= parsedRoute.broadcastNumber;
		}) || (netInfo.routes || []).find(function(route) {
			return route && !route.via && parseIPv4CIDR(route.target);
		});
		var currentPoolCidr = directIPv4Route ? directIPv4Route.target : '';
		var currentPool = parseIPv4CIDR(currentPoolCidr);
		return E('div', { 'class': 'ztc-network-content' }, [
			// Network Overview & Backup Actions
			E('div', { 'class': 'cbi-section ztc-card ztc-overview' }, [
				E('div', {}, [
					E('h3', { 'class': 'ztc-heading-reset' }, [ netInfo.name || 'Network', ' (', nwid, ')' ]),
					E('span', { 'class': 'ztc-subtitle' }, [
						_('IP Pool: '), (netInfo.ipAssignmentPools && netInfo.ipAssignmentPools[0]) ? 
							(netInfo.ipAssignmentPools[0].ipRangeStart + ' - ' + netInfo.ipAssignmentPools[0].ipRangeEnd) : 'None'
					])
				]),
				E('div', {}, [
					E('button', {
						'class': 'btn cbi-button-action',
						'click': function(ev) {
							ev.preventDefault();
							return callExportBackup(nwid).then(requireRpcResult).then(function(backupData) {
								var blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
								var a = document.createElement('a');
								var objectUrl = window.URL.createObjectURL(blob);
								a.href = objectUrl;
								a.download = 'zt-backup-' + nwid + '.json';
								document.body.appendChild(a);
								a.click();
								a.remove();
								window.setTimeout(function() { window.URL.revokeObjectURL(objectUrl); }, 1000);
							}).catch(handleRpcError);
						}
					}, [ _('Export Backup (JSON)') ])
				])
			]),

			// Managed IPv4 pool editor
			E('div', { 'class': 'cbi-section ztc-card' }, [
				E('h3', {}, [ _('Managed IPv4 Pool') ]),
				E('div', { 'class': 'ztc-form-row' }, [
					E('div', { 'class': 'ztc-form-field' }, [
						E('label', { 'for': 'ip-pool-cidr' }, [ _('Network CIDR:') ]),
						E('input', {
							'type': 'text',
							'id': 'ip-pool-cidr',
							'value': currentPoolCidr,
							'placeholder': '10.16.0.1/24',
							'class': 'ztc-full ztc-code',
							'input': function(ev) {
								var preview = document.getElementById('ip-pool-preview');
								var parsed = parseIPv4CIDR(ev.target.value);
								if (!preview) return;
								preview.textContent = parsed ?
									_('Network: %s · Assignable: %s - %s').format(parsed.cidr, parsed.start, parsed.end) :
									_('Enter a valid IPv4 CIDR using a prefix between /8 and /30.');
							}
						}),
						E('p', { 'class': 'ztc-help' }, [
							_('Host addresses are accepted and normalized automatically, for example 10.16.0.1/24 becomes 10.16.0.0/24.')
						])
					]),
					E('button', {
						'class': 'btn cbi-button-save',
						'click': function(ev) {
							ev.preventDefault();
							var input = document.getElementById('ip-pool-cidr');
							var parsed = parseIPv4CIDR(input && input.value);
							if (!parsed) {
								showNotification(_('Enter a valid IPv4 CIDR using a prefix between /8 and /30.'), 'warning');
								return;
							}
							return callUpdateIPPool(nwid, parsed.cidr, currentPoolCidr)
								.then(requireRpcResult)
								.then(function(res) {
									showNotification(_('IP pool updated to ') + (res.cidr || parsed.cidr), 'success');
									self.loadNetworkDetails(nwid);
								})
								.catch(handleRpcError);
						}
					}, [ _('Save IP Pool') ])
				]),
				E('div', { 'class': 'ztc-pool-preview', 'id': 'ip-pool-preview' }, [
					currentPool ?
						_('Network: %s · Assignable: %s - %s').format(currentPool.cidr, currentPool.start, currentPool.end) :
						_('No managed IPv4 pool is configured.')
				]),
				E('p', { 'class': 'ztc-help' }, [
					_('Changing the pool updates its direct managed route. Existing member IP assignments are kept until changed manually or reassigned by the Controller.')
				])
			]),

			// Members Card (Default Online Filter + Sorting)
			E('div', { 'class': 'cbi-section ztc-card' }, [
				E('div', { 'class': 'ztc-overview ztc-card-heading' }, [
					E('h3', { 'class': 'ztc-heading-reset' }, [ _('Network Members ('), members.length, ')' ]),
					E('div', { 'class': 'ztc-actions' }, [
						E('button', {
							'class': 'btn cbi-button-neutral',
							'click': function(ev) {
								ev.preventDefault();
								self.loadNetworkDetails(nwid);
							}
						}, [ _('Refresh') ]),
						E('a', { 'href': '#add-member-section', 'class': 'btn cbi-button-action' }, [ _('Add Member Manually') ])
					])
				]),

				// Filter Bar
				E('div', { 'class': 'ztc-filterbar' }, [
					E('div', { 'class': 'ztc-filterfield' }, [
						E('label', {}, [ _('Status:') ]),
						E('select', { 'id': 'status-filter-select', 'change': this.filterMembersTable.bind(this) }, [
							E('option', { 'value': 'online', 'selected': 'selected' }, [ _('Online Only') ]),
							E('option', { 'value': 'all' }, [ _('All Members') ]),
							E('option', { 'value': 'offline' }, [ _('Offline Only') ])
						])
					]),
					E('div', { 'class': 'ztc-filterfield ztc-filterfield-grow' }, [
						E('label', {}, [ _('Search:') ]),
						E('input', { 'type': 'text', 'id': 'member-search-input', 'class': 'ztc-full', 'placeholder': _('Search Node ID, Name, or IP...'), 'keyup': this.filterMembersTable.bind(this) })
					])
				]),

				// Members Table Container
				E('div', { 'class': 'ztc-table-wrap' }, [
					E('table', { 'class': 'table cbi-section-table ztc-members-table', 'id': 'members-table' }, [
						E('thead', {}, [
							E('tr', {}, [
								E('th', { 'class': 'ztc-table-sort', 'click': this.sortMembersTable.bind(this, 0) }, [ _('Node ID') ]),
								E('th', { 'class': 'ztc-table-sort', 'click': this.sortMembersTable.bind(this, 1) }, [ _('Name / Note') ]),
								E('th', { 'class': 'ztc-table-sort', 'click': this.sortMembersTable.bind(this, 2) }, [ _('Assigned IP') ]),
								E('th', { 'class': 'ztc-table-sort', 'click': this.sortMembersTable.bind(this, 3) }, [ _('Connection') ]),
								E('th', { 'class': 'ztc-table-sort', 'click': this.sortMembersTable.bind(this, 4) }, [ _('Status') ]),
								E('th', { 'class': 'cbi-section-table-cell' }, [ _('Actions') ])
							])
						]),
						E('tbody', { 'id': 'members-tbody' },
							members.map(function(m) {
								var memberId = String(m.id || '').toLowerCase();
								var isController = (memberId === nwid.substring(0, 10).toLowerCase());
								var connection = isController ?
									{ online: true, mode: 'local', latency: -1 } :
									(peerConnections[memberId] || { online: false, mode: 'offline', latency: -1 });
								var modeLabel = {
									direct: 'DIRECT',
									relay: 'RELAY',
									local: 'LOCAL',
									offline: 'OFFLINE'
								}[connection.mode] || 'OFFLINE';

								return E('tr', {
									'data-online': connection.online ? 'true' : 'false',
									'data-search': (memberId + ' ' + (m.name || '') + ' ' + (m.ipAssignments || []).join(' ') + ' ' + modeLabel).toLowerCase()
								}, [
									E('td', { 'class': 'ztc-member-id ztc-code', 'title': memberId }, [ memberId ]),
									E('td', {}, [
										E('input', {
											'type': 'text',
											'value': m.name || '',
											'placeholder': _('Set Name'),
											'change': function(ev) {
												callRenameMember(nwid, memberId, ev.target.value)
													.then(requireRpcResult)
													.catch(handleRpcError);
											}
										})
									]),
									E('td', {}, [
										E('input', {
											'type': 'text',
											'class': 'ztc-code',
											'value': (m.ipAssignments || []).join(', '),
											'placeholder': _('e.g. 10.x.y.z'),
											'change': function(ev) {
												var ips = ev.target.value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
												callChangeMemberIP(nwid, memberId, ips)
													.then(requireRpcResult)
													.catch(handleRpcError);
											}
										})
									]),
									E('td', {}, [
										E('div', { 'class': 'ztc-connection' }, [
											E('span', { 'class': 'ztc-link-mode ztc-link-' + connection.mode }, [ modeLabel ]),
											(connection.online && connection.latency >= 0) ?
												E('span', { 'class': 'ztc-latency' }, [ connection.latency + ' ms' ]) : ''
										])
									]),
									E('td', {}, [
										E('span', {
											'class': 'ztc-auth-badge ' + (m.authorized ? 'ztc-auth-authorized' : 'ztc-auth-pending')
										}, [ m.authorized ? _('Authorized') : _('Pending') ])
									]),
									E('td', {}, [
										E('div', { 'class': 'ztc-member-actions' }, [
											E('button', {
												'class': m.authorized ? 'btn cbi-button-reset' : 'btn cbi-button-save',
												'click': function(ev) {
													ev.preventDefault();
													return callAuthorizeMember(nwid, memberId, !m.authorized).then(requireRpcResult).then(function() {
														self.loadNetworkDetails(nwid);
													}).catch(handleRpcError);
												}
											}, [ m.authorized ? _('Deauth') : _('Authorize') ]),
											E('button', {
												'class': 'btn cbi-button-remove',
												'disabled': isController ? 'disabled' : null,
												'click': function(ev) {
													ev.preventDefault();
													if (confirm(_('Delete member ') + memberId + '?')) {
														return callDeleteMember(nwid, memberId).then(requireRpcResult).then(function() {
															self.loadNetworkDetails(nwid);
														}).catch(handleRpcError);
													}
												}
											}, [ _('Delete') ])
										])
									])
								]);
							})
						)
					])
				])
			]),

			// Add Member Form Card
			E('div', { 'class': 'cbi-section ztc-card', 'id': 'add-member-section' }, [
				E('h3', {}, [ _('Add Member Manually') ]),
				E('div', { 'class': 'ztc-form-row' }, [
					E('div', { 'class': 'ztc-form-field' }, [
						E('label', {}, [ _('Node ID (10 chars):') ]),
						E('input', { 'type': 'text', 'id': 'add-nodeid', 'class': 'ztc-full ztc-code', 'placeholder': 'e.g. bab1e61f17', 'maxlength': 10 })
					]),
					E('div', { 'class': 'ztc-form-field' }, [
						E('label', {}, [ _('Name / Note:') ]),
						E('input', { 'type': 'text', 'id': 'add-name', 'class': 'ztc-full', 'placeholder': 'e.g. Laptop' })
					]),
					E('button', {
						'class': 'btn cbi-button-save',
						'click': function(ev) {
							ev.preventDefault();
							var nodeid = document.getElementById('add-nodeid').value;
							var name = document.getElementById('add-name').value;
								if (!nodeid || nodeid.length !== 10) {
								showNotification(_('Node ID must be 10 characters.'), 'warning');
								return;
							}
							return callAuthorizeMember(nwid, nodeid, true)
								.then(requireRpcResult)
								.then(function() {
									return name ? callRenameMember(nwid, nodeid, name).then(requireRpcResult) : null;
								})
								.then(function() { self.loadNetworkDetails(nwid); })
								.catch(handleRpcError);
						}
					}, [ _('Add & Authorize') ])
				])
			]),

			// Routes Card
			E('div', { 'class': 'cbi-section ztc-card' }, [
				E('h3', {}, [ _('Routes Configuration') ]),
				E('table', { 'class': 'table cbi-section-table ztc-route-table' }, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, [ _('Target CIDR') ]),
							E('th', {}, [ _('Via Gateway') ]),
							E('th', {}, [ _('Action') ])
						])
					]),
					E('tbody', {},
						(netInfo.routes || []).map(function(r) {
							return E('tr', {}, [
								E('td', { 'class': 'ztc-code' }, [ r.target ]),
								E('td', { 'class': r.via ? 'ztc-code' : '' }, [ r.via || _('Direct') ]),
								E('td', {}, [
									E('button', {
										'class': 'btn cbi-button-remove',
										'click': function(ev) {
											ev.preventDefault();
											return callDelRoute(nwid, r.target).then(requireRpcResult).then(function() {
												self.loadNetworkDetails(nwid);
											}).catch(handleRpcError);
										}
									}, [ _('Delete Route') ])
								])
							]);
						})
					)
				]),
				E('div', { 'class': 'ztc-route-form' }, [
					E('div', { 'class': 'ztc-form-field' }, [
						E('label', {}, [ _('Target CIDR:') ]),
						E('input', { 'type': 'text', 'id': 'route-target', 'class': 'ztc-full ztc-code', 'placeholder': 'e.g. 10.10.0.0/24' })
					]),
					E('div', { 'class': 'ztc-form-field' }, [
						E('label', {}, [ _('Via Gateway (Optional):') ]),
						E('input', { 'type': 'text', 'id': 'route-via', 'class': 'ztc-full ztc-code', 'placeholder': 'e.g. 10.121.15.1' })
					]),
					E('button', {
						'class': 'btn cbi-button-save',
						'click': function(ev) {
							ev.preventDefault();
							var target = document.getElementById('route-target').value;
							var via = document.getElementById('route-via').value;
							if (!target) return;
							return callAddRoute(nwid, target, via).then(requireRpcResult).then(function() {
								self.loadNetworkDetails(nwid);
							}).catch(handleRpcError);
						}
					}, [ _('Add Route') ])
				])
			])
		]);
	},

	filterMembersTable: function() {
		var statusFilter = document.getElementById('status-filter-select');
		var searchInput = document.getElementById('member-search-input');
		if (!statusFilter || !searchInput) return;

		var filterVal = statusFilter.value;
		var searchVal = searchInput.value.toLowerCase().trim();
		var rows = document.querySelectorAll('#members-tbody tr');

		rows.forEach(function(row) {
			var isOnline = row.getAttribute('data-online') === 'true';
			var searchData = row.getAttribute('data-search') || '';

			var matchesStatus = (filterVal === 'all') || (filterVal === 'online' && isOnline) || (filterVal === 'offline' && !isOnline);
			var matchesSearch = searchData.indexOf(searchVal) !== -1;

			if (matchesStatus && matchesSearch) {
				row.style.display = '';
			} else {
				row.style.display = 'none';
			}
		});
	},

	sortMembersTable: function(colIdx) {
		var tbody = document.getElementById('members-tbody');
		if (!tbody) return;
		var rows = Array.from(tbody.querySelectorAll('tr'));

		rows.sort(function(a, b) {
			var valA = a.children[colIdx] ? a.children[colIdx].textContent.trim().toLowerCase() : '';
			var valB = b.children[colIdx] ? b.children[colIdx].textContent.trim().toLowerCase() : '';
			return valA.localeCompare(valB);
		});

		tbody.innerHTML = '';
		rows.forEach(function(r) { tbody.appendChild(r); });
	}
});
