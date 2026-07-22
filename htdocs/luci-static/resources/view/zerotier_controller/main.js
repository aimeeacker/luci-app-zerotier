'use strict';
'use ui';

/* ZeroTier Controller Management View for OpenWrt LuCI 21.02+ / 24.10+ */

var callStatus = L.rpc.declare({
	object: 'zerotier-controller',
	method: 'status'
});

var callListNetworks = L.rpc.declare({
	object: 'zerotier-controller',
	method: 'list_networks'
});

var callGetNetworkInfo = L.rpc.declare({
	object: 'zerotier-controller',
	method: 'get_network_info',
	params: [ 'nwid' ]
});

var callCreateNetwork = L.rpc.declare({
	object: 'zerotier-controller',
	method: 'create_network',
	params: [ 'name' ]
});

var callListMembers = L.rpc.declare({
	object: 'zerotier-controller',
	method: 'list_members',
	params: [ 'nwid' ]
});

var callAuthorizeMember = L.rpc.declare({
	object: 'zerotier-controller',
	method: 'authorize_member',
	params: [ 'nwid', 'nodeid', 'authorized' ]
});

var callChangeMemberIP = L.rpc.declare({
	object: 'zerotier-controller',
	method: 'change_member_ip',
	params: [ 'nwid', 'nodeid', 'ip_assignments' ]
});

var callRenameMember = L.rpc.declare({
	object: 'zerotier-controller',
	method: 'rename_member',
	params: [ 'nwid', 'nodeid', 'name' ]
});

var callAddRoute = L.rpc.declare({
	object: 'zerotier-controller',
	method: 'add_route',
	params: [ 'nwid', 'target', 'via' ]
});

var callDelRoute = L.rpc.declare({
	object: 'zerotier-controller',
	method: 'del_route',
	params: [ 'nwid', 'target' ]
});

var callDeleteMember = L.rpc.declare({
	object: 'zerotier-controller',
	method: 'delete_member',
	params: [ 'nwid', 'nodeid' ]
});

var callExportBackup = L.rpc.declare({
	object: 'zerotier-controller',
	method: 'export_backup',
	params: [ 'nwid' ]
});

var callImportBackup = L.rpc.declare({
	object: 'zerotier-controller',
	method: 'import_backup',
	params: [ 'backup_data' ]
});

return L.view.extend({
	handleSaveAndApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return Promise.all([
			callStatus(),
			callListNetworks()
		]);
	},

	render: function(data) {
		var status = data[0] || {};
		var networksData = data[1] || {};
		var networks = (networksData && Array.isArray(networksData.networks)) ? networksData.networks : [];
		var activeNwid = (networks && networks.length > 0) ? networks[0] : null;

		var viewContainer = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, [ _('ZeroTier Controller Dashboard') ]),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('Lightweight native OpenWrt management console for self-hosted ZeroTier Controller.')
			]),

			// Controller Status Card
			E('div', { 'class': 'cbi-section', 'style': 'padding: 16px; margin-bottom: 20px; border-radius: 8px;' }, [
				E('div', { 'style': 'display: flex; justify-content: space-between; align-items: center;' }, [
					E('div', {}, [
						E('strong', { 'style': 'font-size: 16px;' }, [ _('Controller Node ID: '), status.address || 'Offline' ]),
						E('span', { 'style': 'margin-left: 12px; font-size: 12px; color: #888;' }, [
							status.version ? 'v' + status.version : ''
						])
					]),
					E('div', { 'style': 'display: inline-flex; align-items: center; gap: 8px;' }, [
						E('span', { 'class': 'badge', 'style': status.online !== false ? 'background: #10b981; color: #fff; padding: 4px 10px; border-radius: 12px;' : 'background: #ef4444; color: #fff; padding: 4px 10px; border-radius: 12px;' }, [
							status.online !== false ? _('Controller Active') : _('Controller Down')
						])
					])
				])
			]),

			// Main Dashboard Layout Grid
			E('div', { 'style': 'display: grid; grid-template-columns: 280px 1fr; gap: 20px;' }, [
				// Sidebar
				E('div', {}, [
					// Network List Card
					E('div', { 'class': 'cbi-section' }, [
						E('h3', {}, [ _('Managed Networks') ]),
						E('div', { 'id': 'network-list-box' }, [
							networks.length === 0 ? E('p', { 'style': 'color: #888;' }, [ _('No networks created yet.') ]) : E('ul', { 'class': 'cbi-section-node', 'style': 'list-style: none; padding: 0;' }, 
								networks.map(function(nwid) {
									return E('li', { 'style': 'margin-bottom: 8px;' }, [
										E('button', {
											'class': 'btn cbi-button-action',
											'style': 'width: 100%; text-align: left; font-family: monospace;',
											'click': ui.createHandler(this, function() {
												this.loadNetworkDetails(nwid);
											}.bind(this))
										}, [ nwid ])
									]);
								}.bind(this))
							)
						])
					]),

					// Create Network Card
					E('div', { 'class': 'cbi-section', 'style': 'margin-top: 16px;' }, [
						E('h3', {}, [ _('Create Network') ]),
						E('div', { 'class': 'cbi-value' }, [
							E('input', { 'type': 'text', 'id': 'new-net-name', 'placeholder': 'Network Name', 'style': 'width: 100%; margin-bottom: 8px;' }),
							E('button', {
								'class': 'btn cbi-button-save',
								'style': 'width: 100%;',
								'click': ui.createHandler(this, function() {
									var name = document.getElementById('new-net-name').value || 'new_network';
									return callCreateNetwork(name).then(function(res) {
										ui.addNotification(null, E('p', {}, [ _('Created network: ') + (res.nwid || res.id) ]), 'info');
										location.reload();
									});
								})
							}, [ _('Create New Network') ])
						])
					]),

					// Import Backup Card
					E('div', { 'class': 'cbi-section', 'style': 'margin-top: 16px;' }, [
						E('h3', {}, [ _('Import JSON Backup') ]),
						E('div', { 'class': 'cbi-value' }, [
							E('input', { 'type': 'file', 'id': 'backup-file-input', 'accept': '.json', 'style': 'width: 100%; margin-bottom: 8px;' }),
							E('button', {
								'class': 'btn cbi-button-action',
								'style': 'width: 100%;',
								'click': ui.createHandler(this, function() {
									var fileInput = document.getElementById('backup-file-input');
									if (!fileInput.files || !fileInput.files[0]) {
										ui.addNotification(null, E('p', {}, [ _('Please select a JSON backup file.') ]), 'error');
										return;
									}
									var reader = new FileReader();
									reader.onload = function(e) {
										callImportBackup(e.target.result).then(function(res) {
											ui.addNotification(null, E('p', {}, [ _('Network backup restored successfully.') ]), 'info');
											location.reload();
										});
									};
									reader.readAsText(fileInput.files[0]);
								})
							}, [ _('Import Backup') ])
						])
					])
				]),

				// Main Content Column
				E('div', { 'id': 'main-network-panel' }, [
					E('div', { 'class': 'cbi-section' }, [
						E('p', { 'style': 'color: #888;' }, [ _('Select a network from the sidebar to view members and configuration.') ])
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
		panel.innerHTML = '';
		panel.appendChild(E('p', {}, [ _('Loading network details for ') + nwid + '...' ]));

		Promise.all([
			callGetNetworkInfo(nwid),
			callListMembers(nwid)
		]).then(function(res) {
			var netInfo = res[0] || {};
			var membersRes = res[1] || {};
			var membersMap = (membersRes && membersRes.members) ? membersRes.members : {};
			var peersMap = (membersRes && Array.isArray(membersRes.peers)) ? membersRes.peers : [];
			
			// Build peers lookup table
			var peerLastSeen = {};
			var peerLatency = {};
			peersMap.forEach(function(p) {
				if (p && p.address) {
					peerLastSeen[p.address] = p.lastSend || 0;
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
			panel.appendChild(this.renderDashboardContent(nwid, netInfo, membersList, peerLastSeen, peerLatency));
			
			// Apply default filter: Online Only
			this.filterMembersTable();
		}.bind(this));
	},

	renderDashboardContent: function(nwid, netInfo, members, peerLastSeen, peerLatency) {
		return E('div', {}, [
			// Network Overview & Backup Actions
			E('div', { 'class': 'cbi-section', 'style': 'display: flex; justify-content: space-between; align-items: center;' }, [
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
						'click': ui.createHandler(this, function() {
							callExportBackup(nwid).then(function(backupData) {
								var blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
								var a = document.createElement('a');
								a.href = URL.createObjectURL(blob);
								a.download = 'zt-backup-' + nwid + '.json';
								a.click();
							});
						})
					}, [ _('Export Backup (JSON)') ])
				])
			]),

			// Members Card (Default Online Filter + Sorting)
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;' }, [
					E('h3', { 'style': 'margin: 0;' }, [ _('Network Members ('), members.length, ')' ]),
					E('div', {}, [
						E('button', {
							'class': 'btn cbi-button-neutral',
							'style': 'margin-right: 8px;',
							'click': ui.createHandler(this, function() {
								this.loadNetworkDetails(nwid);
							}.bind(this))
						}, [ _('Refresh') ]),
						E('a', { 'href': '#add-member-section', 'class': 'btn cbi-button-action' }, [ _('Add Member Manually') ])
					])
				]),

				// Filter Bar
				E('div', { 'style': 'display: flex; gap: 12px; margin-bottom: 12px; background: rgba(0,0,0,0.03); padding: 10px; border-radius: 6px;' }, [
					E('div', { 'style': 'display: flex; align-items: center; gap: 6px;' }, [
						E('label', {}, [ _('Status:') ]),
						E('select', { 'id': 'status-filter-select', 'change': this.filterMembersTable.bind(this) }, [
							E('option', { 'value': 'online', 'selected': 'selected' }, [ _('Online Only') ]),
							E('option', { 'value': 'all' }, [ _('All Members') ]),
							E('option', { 'value': 'offline' }, [ _('Offline Only') ])
						])
					]),
					E('div', { 'style': 'display: flex; align-items: center; gap: 6px; flex-grow: 1;' }, [
						E('label', {}, [ _('Search:') ]),
						E('input', { 'type': 'text', 'id': 'member-search-input', 'placeholder': _('Search Node ID, Name, or IP...'), 'keyup': this.filterMembersTable.bind(this), 'style': 'width: 100%;' })
					])
				]),

				// Members Table Container
				E('div', { 'style': 'max-height: 500px; overflow: auto; border: 1px solid #ddd; border-radius: 6px;' }, [
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
								var isOnline = isController || ((peerLastSeen[m.id] || 0) > 0);
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
											'change': ui.createHandler(this, function(ev) {
												callRenameMember(nwid, m.id, ev.target.value);
											})
										})
									]),
									E('td', {}, [
										E('input', {
											'type': 'text',
											'value': (m.ipAssignments || []).join(', '),
											'placeholder': _('e.g. 10.x.y.z'),
											'change': ui.createHandler(this, function(ev) {
												var ips = ev.target.value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
												callChangeMemberIP(nwid, m.id, ips);
											})
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
											'click': ui.createHandler(this, function() {
												callAuthorizeMember(nwid, m.id, !m.authorized).then(function() {
													this.loadNetworkDetails(nwid);
												}.bind(this));
											}.bind(this))
										}, [ m.authorized ? _('Deauth') : _('Authorize') ]),
										E('button', {
											'class': 'btn cbi-button-remove',
											'disabled': isController ? 'disabled' : null,
											'click': ui.createHandler(this, function() {
												if (confirm(_('Delete member ') + m.id + '?')) {
													callDeleteMember(nwid, m.id).then(function() {
														this.loadNetworkDetails(nwid);
													}.bind(this));
												}
											}.bind(this))
										}, [ _('Delete') ])
									])
								]);
							}.bind(this))
						)
					])
				])
			]),

			// Add Member Form Card
			E('div', { 'class': 'cbi-section', 'id': 'add-member-section' }, [
				E('h3', {}, [ _('Add Member Manually') ]),
				E('div', { 'style': 'display: flex; gap: 12px; align-items: flex-end;' }, [
					E('div', { 'style': 'flex: 1;' }, [
						E('label', {}, [ _('Node ID (10 chars):') ]),
						E('input', { 'type': 'text', 'id': 'add-nodeid', 'placeholder': 'e.g. bab1e61f17', 'maxlength': 10, 'style': 'width: 100%;' })
					]),
					E('div', { 'style': 'flex: 1;' }, [
						E('label', {}, [ _('Name / Note:') ]),
						E('input', { 'type': 'text', 'id': 'add-name', 'placeholder': 'e.g. Laptop', 'style': 'width: 100%;' })
					]),
					E('button', {
						'class': 'btn cbi-button-save',
						'click': ui.createHandler(this, function() {
							var nodeid = document.getElementById('add-nodeid').value;
							var name = document.getElementById('add-name').value;
							if (!nodeid || nodeid.length !== 10) {
								ui.addNotification(null, E('p', {}, [ _('Node ID must be 10 characters.') ]), 'error');
								return;
							}
							callAuthorizeMember(nwid, nodeid, true).then(function() {
								if (name) callRenameMember(nwid, nodeid, name);
								this.loadNetworkDetails(nwid);
							}.bind(this));
						}.bind(this))
					}, [ _('Add & Authorize') ])
				])
			]),

			// Routes Card
			E('div', { 'class': 'cbi-section' }, [
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
										'click': ui.createHandler(this, function() {
											callDelRoute(nwid, r.target).then(function() {
												this.loadNetworkDetails(nwid);
											}.bind(this));
										}.bind(this))
									}, [ _('Delete Route') ])
								])
							]);
						}.bind(this))
					)
				]),
				E('div', { 'style': 'display: flex; gap: 12px; align-items: flex-end;' }, [
					E('div', { 'style': 'flex: 1;' }, [
						E('label', {}, [ _('Target CIDR:') ]),
						E('input', { 'type': 'text', 'id': 'route-target', 'placeholder': 'e.g. 10.10.0.0/24', 'style': 'width: 100%;' })
					]),
					E('div', { 'style': 'flex: 1;' }, [
						E('label', {}, [ _('Via Gateway (Optional):') ]),
						E('input', { 'type': 'text', 'id': 'route-via', 'placeholder': 'e.g. 10.121.15.1', 'style': 'width: 100%;' })
					]),
					E('button', {
						'class': 'btn cbi-button-save',
						'click': ui.createHandler(this, function() {
							var target = document.getElementById('route-target').value;
							var via = document.getElementById('route-via').value;
							if (!target) return;
							callAddRoute(nwid, target, via).then(function() {
								this.loadNetworkDetails(nwid);
							}.bind(this));
						}.bind(this))
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
