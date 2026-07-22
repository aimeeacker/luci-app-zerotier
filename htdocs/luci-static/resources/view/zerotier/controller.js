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

function dashboardStyles() {
	return [
		'.ztc-dashboard { --ztc-accent: var(--primary-color, #2563eb); --ztc-success: #16a34a; --ztc-danger: #dc2626; --ztc-warning: #d97706; --ztc-radius: 12px; }',
		'.ztc-dashboard .ztc-hero { display:flex; align-items:center; justify-content:space-between; gap:20px; margin:0 0 18px; padding:22px 24px; overflow:hidden; border-radius:16px; color:#fff; background:linear-gradient(135deg, #172554 0%, #1d4ed8 58%, #0891b2 100%); box-shadow:0 14px 34px rgba(30, 64, 175, .20); }',
		'.ztc-dashboard .ztc-hero-main { display:flex; align-items:center; gap:16px; min-width:0; }',
		'.ztc-dashboard .ztc-brandmark { display:grid; place-items:center; flex:0 0 48px; width:48px; height:48px; border:1px solid rgba(255,255,255,.35); border-radius:14px; background:rgba(255,255,255,.14); font-size:17px; font-weight:800; letter-spacing:.06em; backdrop-filter:blur(8px); }',
		'.ztc-dashboard .ztc-hero h2 { margin:0 0 4px; padding:0; border:0; color:#fff; font-size:clamp(20px, 2.5vw, 28px); }',
		'.ztc-dashboard .ztc-hero p { margin:0; color:rgba(255,255,255,.82); line-height:1.5; }',
		'.ztc-dashboard .ztc-count { flex:0 0 auto; padding:7px 12px; border:1px solid rgba(255,255,255,.28); border-radius:999px; background:rgba(255,255,255,.12); font-weight:600; white-space:nowrap; }',
		'.ztc-dashboard .ztc-card { margin:0 0 16px; padding:18px; border:1px solid var(--border-color-medium, rgba(100,116,139,.22)); border-radius:var(--ztc-radius); background:var(--background-color-high, rgba(255,255,255,.98)); box-shadow:0 6px 20px rgba(15,23,42,.055); }',
		'.ztc-dashboard .ztc-card h3 { margin:0 0 14px; padding:0; border:0; font-size:16px; }',
		'.ztc-dashboard .ztc-status-card { display:flex; align-items:center; justify-content:space-between; gap:18px; border-left:4px solid var(--ztc-accent); }',
		'.ztc-dashboard .ztc-eyebrow { display:block; margin-bottom:5px; color:var(--text-color-medium, #64748b); font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }',
		'.ztc-dashboard .ztc-node-id { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:17px; overflow-wrap:anywhere; }',
		'.ztc-dashboard .ztc-version { margin-left:8px; color:var(--text-color-medium, #64748b); font-size:12px; }',
		'.ztc-dashboard .ztc-status-pills { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; }',
		'.ztc-dashboard .ztc-pill { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; color:#fff; font-size:12px; font-weight:700; white-space:nowrap; }',
		'.ztc-dashboard .ztc-pill::before { content:""; width:7px; height:7px; border-radius:50%; background:currentColor; box-shadow:0 0 0 3px rgba(255,255,255,.18); }',
		'.ztc-dashboard .ztc-pill-success { background:var(--ztc-success); }',
		'.ztc-dashboard .ztc-pill-danger { background:var(--ztc-danger); }',
		'.ztc-dashboard .ztc-pill-warning { background:var(--ztc-warning); }',
		'.ztc-dashboard .ztc-error { margin:10px 0 0; padding:9px 11px; border-radius:8px; color:#991b1b; background:rgba(254,226,226,.86); font-size:13px; }',
		'.ztc-dashboard .ztc-layout { display:grid; grid-template-columns:minmax(245px, 300px) minmax(0, 1fr); gap:18px; align-items:start; }',
		'.ztc-dashboard .ztc-sidebar { position:sticky; top:12px; }',
		'.ztc-dashboard .ztc-network-list { display:grid; gap:8px; margin:0; padding:0; list-style:none; }',
		'.ztc-dashboard .ztc-network-button { width:100%; padding:9px 11px; overflow:hidden; border:1px solid rgba(37,99,235,.20); border-radius:8px; text-align:left; text-overflow:ellipsis; font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space:nowrap; }',
		'.ztc-dashboard .ztc-network-button.is-active { border-color:var(--ztc-accent); color:#fff; background:var(--ztc-accent); box-shadow:0 5px 14px rgba(37,99,235,.22); }',
		'.ztc-dashboard .ztc-empty { display:grid; min-height:150px; place-items:center; padding:24px; border:1px dashed var(--border-color-medium, #cbd5e1); border-radius:var(--ztc-radius); color:var(--text-color-medium, #64748b); text-align:center; }',
		'.ztc-dashboard .ztc-empty-small { min-height:70px; padding:14px; }',
		'.ztc-dashboard .ztc-field { margin:0 0 10px; padding:0; }',
		'.ztc-dashboard input[type="text"], .ztc-dashboard input[type="file"], .ztc-dashboard select { box-sizing:border-box; max-width:none; border-radius:7px; }',
		'.ztc-dashboard .ztc-card button { min-height:34px; border-radius:7px; }',
		'.ztc-dashboard button[disabled] { cursor:not-allowed; opacity:.55; }',
		'.ztc-dashboard .ztc-overview { display:flex; align-items:center; justify-content:space-between; gap:16px; }',
		'.ztc-dashboard .ztc-filterbar { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:14px; padding:11px; border-radius:9px; background:rgba(100,116,139,.08); }',
		'.ztc-dashboard .ztc-filterfield { display:flex; align-items:center; gap:7px; min-width:180px; }',
		'.ztc-dashboard .ztc-filterfield-grow { flex:1 1 280px; }',
		'.ztc-dashboard .ztc-table-wrap { max-height:520px; overflow:auto; border:1px solid var(--border-color-medium, #dbe2ea); border-radius:9px; }',
		'.ztc-dashboard .ztc-table-wrap table { margin:0; }',
		'.ztc-dashboard .ztc-table-wrap thead th { position:sticky; top:0; z-index:1; background:var(--background-color-high, #fff); white-space:nowrap; }',
		'.ztc-dashboard .ztc-table-wrap tbody tr:hover { background:rgba(37,99,235,.045); }',
		'.ztc-dashboard .ztc-form-row { display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; }',
		'.ztc-dashboard .ztc-form-field { flex:1 1 210px; min-width:0; }',
		'.ztc-dashboard .ztc-form-field label { display:block; margin-bottom:6px; font-weight:600; }',
		'.ztc-toast-stack { position:fixed; z-index:10000; top:18px; right:18px; display:grid; gap:10px; width:min(390px, calc(100vw - 36px)); pointer-events:none; }',
		'.ztc-toast { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; padding:13px 14px; border-left:4px solid #2563eb; border-radius:10px; color:#0f172a; background:#fff; box-shadow:0 14px 35px rgba(15,23,42,.22); pointer-events:auto; }',
		'.ztc-toast-success { border-left-color:var(--ztc-success); }',
		'.ztc-toast-warning { border-left-color:var(--ztc-warning); }',
		'.ztc-toast-error { border-left-color:var(--ztc-danger); }',
		'.ztc-toast-close { min-height:0 !important; padding:0 2px; border:0; color:#64748b; background:transparent; font-size:20px; line-height:1; cursor:pointer; }',
		'@media (max-width: 900px) { .ztc-dashboard .ztc-layout { grid-template-columns:1fr; } .ztc-dashboard .ztc-sidebar { position:static; } .ztc-dashboard .ztc-status-card, .ztc-dashboard .ztc-overview { align-items:flex-start; flex-direction:column; } .ztc-dashboard .ztc-status-pills { justify-content:flex-start; } }',
		'@media (max-width: 560px) { .ztc-dashboard .ztc-hero { align-items:flex-start; padding:18px; } .ztc-dashboard .ztc-brandmark, .ztc-dashboard .ztc-count { display:none; } .ztc-dashboard .ztc-card { padding:14px; } .ztc-dashboard .ztc-form-row > button { width:100%; } }'
	].join('\n');
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
					E('strong', { 'class': 'ztc-node-id' }, [ status.address || _('Unavailable') ]),
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
											'class': 'btn cbi-button-action ztc-network-button' + (nwid === activeNwid ? ' is-active' : ''),
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
							E('input', { 'type': 'text', 'id': 'new-net-name', 'placeholder': _('Network Name'), 'style': 'width: 100%; margin-bottom: 8px;' }),
							E('button', {
								'class': 'btn cbi-button-save',
								'style': 'width: 100%;',
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
							E('input', { 'type': 'file', 'id': 'backup-file-input', 'accept': '.json', 'style': 'width: 100%; margin-bottom: 8px;' }),
							E('button', {
								'class': 'btn cbi-button-action',
								'disabled': controllerReady ? null : 'disabled',
								'style': 'width: 100%;',
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
			
			// Build peers lookup table
			var peerOnline = {};
			var peerLatency = {};
			peersMap.forEach(function(p) {
				if (p && p.address) {
					var lastActivity = Math.max(Number(p.lastReceive) || 0, Number(p.lastSend) || 0);
					var hasActivePath = Array.isArray(p.paths) && p.paths.some(function(path) { return path && path.active === true; });
					peerOnline[p.address] = hasActivePath || lastActivity > (Date.now() - 120000);
					peerLatency[p.address] = p.latency !== undefined ? p.latency : -1;
				}
			});

			var membersList = [];
			if (Array.isArray(membersMap)) {
				membersList = membersMap;
			} else if (membersMap && typeof membersMap === 'object') {
				membersList = Object.keys(membersMap).map(function(k) { return membersMap[k]; });
			}

			panel.innerHTML = '';
			panel.appendChild(this.renderDashboardContent(nwid, netInfo, membersList, peerOnline, peerLatency));
			
			// Apply default filter: Online Only
			this.filterMembersTable();
		}.bind(this)).catch(function(err) {
			panel.innerHTML = '';
			panel.appendChild(E('div', { 'class': 'alert-message warning' }, [ rpcErrorMessage({ error: err.message || String(err) }) ]));
		});
	},

	renderDashboardContent: function(nwid, netInfo, members, peerOnline, peerLatency) {
		var self = this;
		return E('div', { 'class': 'ztc-network-content' }, [
			// Network Overview & Backup Actions
			E('div', { 'class': 'cbi-section ztc-card ztc-overview' }, [
				E('div', {}, [
					E('h3', { 'style': 'margin: 0;' }, [ netInfo.name || 'Network', ' (', nwid, ')' ]),
					E('span', { 'style': 'font-size: 12px; color: #888;' }, [
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

			// Members Card (Default Online Filter + Sorting)
			E('div', { 'class': 'cbi-section ztc-card' }, [
				E('div', { 'class': 'ztc-overview', 'style': 'margin-bottom: 14px;' }, [
					E('h3', { 'style': 'margin: 0;' }, [ _('Network Members ('), members.length, ')' ]),
					E('div', {}, [
						E('button', {
							'class': 'btn cbi-button-neutral',
							'style': 'margin-right: 8px;',
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
						E('input', { 'type': 'text', 'id': 'member-search-input', 'placeholder': _('Search Node ID, Name, or IP...'), 'keyup': this.filterMembersTable.bind(this), 'style': 'width: 100%;' })
					])
				]),

				// Members Table Container
				E('div', { 'class': 'ztc-table-wrap' }, [
					E('table', { 'class': 'table cbi-section-table', 'id': 'members-table' }, [
						E('thead', {}, [
							E('tr', {}, [
								E('th', { 'click': this.sortMembersTable.bind(this, 0), 'style': 'cursor: pointer;' }, [ _('Node ID') ]),
								E('th', { 'click': this.sortMembersTable.bind(this, 1), 'style': 'cursor: pointer;' }, [ _('Name / Note') ]),
								E('th', { 'click': this.sortMembersTable.bind(this, 2), 'style': 'cursor: pointer;' }, [ _('Assigned IP') ]),
								E('th', { 'click': this.sortMembersTable.bind(this, 3), 'style': 'cursor: pointer;' }, [ _('Connection') ]),
								E('th', { 'click': this.sortMembersTable.bind(this, 4), 'style': 'cursor: pointer;' }, [ _('Status') ]),
								E('th', { 'class': 'cbi-section-table-cell' }, [ _('Actions') ])
							])
						]),
						E('tbody', { 'id': 'members-tbody' }, 
							members.map(function(m) {
								var isController = (m.id === nwid.substring(0, 10));
								var isOnline = isController || peerOnline[m.id] === true;
								var latency = peerLatency[m.id] !== undefined ? peerLatency[m.id] : -1;

								return E('tr', {
									'data-online': isOnline ? 'true' : 'false',
									'data-search': (m.id + ' ' + (m.name || '') + ' ' + (m.ipAssignments || []).join(' ')).toLowerCase()
								}, [
									E('td', { 'style': 'font-family: monospace; font-weight: bold;' }, [ m.id ]),
									E('td', {}, [
										E('input', {
											'type': 'text',
											'value': m.name || '',
											'placeholder': _('Set Name'),
											'change': function(ev) {
												callRenameMember(nwid, m.id, ev.target.value)
													.then(requireRpcResult)
													.catch(handleRpcError);
											}
										})
									]),
									E('td', {}, [
										E('input', {
											'type': 'text',
											'value': (m.ipAssignments || []).join(', '),
											'placeholder': _('e.g. 10.x.y.z'),
											'change': function(ev) {
												var ips = ev.target.value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
												callChangeMemberIP(nwid, m.id, ips)
													.then(requireRpcResult)
													.catch(handleRpcError);
											}
										})
									]),
									E('td', {}, [
										E('span', { 'class': 'badge', 'style': isOnline ? 'color: #10b981;' : 'color: #888;' }, [
											isOnline ? _('Online ') : _('Offline')
										]),
										(isOnline && latency >= 0) ? E('span', { 'style': 'font-size: 11px; margin-left: 4px; color: #666;' }, [ '(' + latency + 'ms)' ]) : ''
									]),
									E('td', {}, [
										E('span', { 'class': 'badge', 'style': m.authorized ? 'background: #10b981; color: #fff; padding: 2px 6px; border-radius: 4px;' : 'background: #f59e0b; color: #fff; padding: 2px 6px; border-radius: 4px;' }, [
											m.authorized ? _('Authorized') : _('Pending')
										])
									]),
									E('td', {}, [
										E('button', {
											'class': m.authorized ? 'btn cbi-button-reset' : 'btn cbi-button-save',
											'style': 'margin-right: 4px;',
											'click': function(ev) {
												ev.preventDefault();
												return callAuthorizeMember(nwid, m.id, !m.authorized).then(requireRpcResult).then(function() {
													self.loadNetworkDetails(nwid);
												}).catch(handleRpcError);
											}
										}, [ m.authorized ? _('Deauth') : _('Authorize') ]),
										E('button', {
											'class': 'btn cbi-button-remove',
											'disabled': isController ? 'disabled' : null,
											'click': function(ev) {
												ev.preventDefault();
												if (confirm(_('Delete member ') + m.id + '?')) {
													return callDeleteMember(nwid, m.id).then(requireRpcResult).then(function() {
														self.loadNetworkDetails(nwid);
													}).catch(handleRpcError);
												}
											}
										}, [ _('Delete') ])
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
						E('input', { 'type': 'text', 'id': 'add-nodeid', 'placeholder': 'e.g. bab1e61f17', 'maxlength': 10, 'style': 'width: 100%;' })
					]),
					E('div', { 'class': 'ztc-form-field' }, [
						E('label', {}, [ _('Name / Note:') ]),
						E('input', { 'type': 'text', 'id': 'add-name', 'placeholder': 'e.g. Laptop', 'style': 'width: 100%;' })
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
				E('table', { 'class': 'table cbi-section-table', 'style': 'margin-bottom: 16px;' }, [
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
								E('td', { 'style': 'font-family: monospace;' }, [ r.target ]),
								E('td', {}, [ r.via || _('Direct') ]),
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
				E('div', { 'class': 'ztc-form-row' }, [
					E('div', { 'class': 'ztc-form-field' }, [
						E('label', {}, [ _('Target CIDR:') ]),
						E('input', { 'type': 'text', 'id': 'route-target', 'placeholder': 'e.g. 10.10.0.0/24', 'style': 'width: 100%;' })
					]),
					E('div', { 'class': 'ztc-form-field' }, [
						E('label', {}, [ _('Via Gateway (Optional):') ]),
						E('input', { 'type': 'text', 'id': 'route-via', 'placeholder': 'e.g. 10.121.15.1', 'style': 'width: 100%;' })
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
