'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

const callStatus = rpc.declare({
	object: 'disk-init',
	method: 'status'
});

const callInit = rpc.declare({
	object: 'disk-init',
	method: 'init',
	params: [ 'disk', 'label', 'fstype' ]
});

const callShares = rpc.declare({
	object: 'disk-init',
	method: 'shares'
});

const callSetShare = rpc.declare({
	object: 'disk-init',
	method: 'set_share',
	params: [ 'path', 'smb', 'smb_users', 'smb_ro', 'ftp_anon', 'nfs', 'nfs_clients', 'nfs_ro' ]
});

const callSetUser = rpc.declare({
	object: 'disk-init',
	method: 'set_user',
	params: [ 'service', 'action', 'name', 'password', 'root', 'write' ]
});

const FSTYPES = {
	ext4: _('ext4 - Linux, recommended'),
	xfs: _('XFS - Linux, large files'),
	btrfs: _('Btrfs - Linux, checksums and snapshots'),
	f2fs: _('F2FS - Linux, for flash and SSD'),
	exfat: _('exFAT - also readable on Windows and macOS'),
	vfat: _('FAT32 - readable everywhere, files up to 4 GB'),
	ntfs: _('NTFS - Windows')
};

function fmtSize(kib) {
	return '%1024.1mB'.format(kib * 1024);
}

function field(title, input, descr) {
	return E('div', { 'class': 'cbi-value' }, [
		E('label', { 'class': 'cbi-value-title' }, [ title ]),
		E('div', { 'class': 'cbi-value-field' }, [
			input,
			descr ? E('div', { 'class': 'cbi-value-description' }, [ descr ]) : ''
		])
	]);
}

function checkbox(checked, label) {
	const cb = E('input', { 'type': 'checkbox' });
	cb.checked = !!checked;
	return { input: cb, node: E('label', {}, [ cb, ' ', label ]) };
}

function modalButtons(handler, label, negative) {
	return E('div', { 'class': 'right' }, [
		E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Cancel') ]), ' ',
		E('button', {
			'class': 'btn ' + (negative ? 'cbi-button-negative' : 'cbi-button-positive'),
			'click': handler
		}, [ label ])
	]);
}

function warn(msg) {
	ui.addNotification(null, E('p', [ msg ]), 'warning');
}

return view.extend({
	load: function() {
		return Promise.all([ callStatus(), callShares() ]);
	},

	refresh: function() {
		return Promise.all([ callStatus(), callShares() ]).then(L.bind(function(res) {
			this.st = res[0];
			this.sh = res[1];
			this.renderLog();
			this.nodes.disks.replaceChildren(this.renderDisks());
			this.nodes.folders.replaceChildren(this.renderFolders());
			this.nodes.smbUsers.replaceChildren(this.renderSmbUsers());
			this.nodes.ftpUsers.replaceChildren(this.renderFtpUsers());
		}, this));
	},

	/* runs an rpc call from a modal, shows its error or closes the modal */
	submit: function(call) {
		return call.then(L.bind(function(res) {
			if (res && res.error) {
				ui.addNotification(null, E('p', [ res.error ]), 'danger');
				return;
			}
			ui.hideModal();
			if (res && res.warning)
				warn(res.warning);
			return this.refresh();
		}, this)).catch(function(err) {
			ui.addNotification(null, E('p', [ err.message || String(err) ]), 'danger');
		});
	},

	/* ---- disks ---- */

	renderLog: function() {
		const box = this.nodes.log, st = this.st;

		if (!st.state) {
			box.style.display = 'none';
			return;
		}

		const titles = {
			running: _('Setting up the disk...'),
			done: _('Disk setup finished'),
			failed: _('Disk setup failed')
		};

		box.style.display = '';
		box.className = 'alert-message ' +
			(st.state == 'failed' ? 'error' : (st.state == 'done' ? 'success' : 'notice'));
		box.replaceChildren(
			E('h4', {}, [ titles[st.state] || st.state ]),
			E('pre', { 'style': 'white-space:pre-wrap' }, [ st.log || '' ])
		);
	},

	confirmInit: function(disk) {
		const name = [ disk.vendor, disk.model ].filter(Boolean).join(' ') || disk.name;
		const label = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'value': 'data', 'maxlength': 16 });
		const fstype = E('select', { 'class': 'cbi-input-select' },
			(this.st.fstypes || []).map(function(t) {
				return E('option', { 'value': t }, [ FSTYPES[t] || t ]);
			}));
		const sure = checkbox(false, E('strong', {}, [ _('I understand that all data on this disk will be lost') ]));

		ui.showModal(_('Initialize %s').format('/dev/' + disk.name), [
			E('p', { 'class': 'alert-message warning' }, [
				_('ALL DATA on %s (%s, %s) will be erased: every partition and file on it.')
					.format('/dev/' + disk.name, name, fmtSize(disk.size)) ]),
			E('p', {}, [ _('The disk gets one partition with the chosen file system, mounted at /mnt/<name> at every boot. Share it afterwards under Shared folders.') ]),
			field(_('Name'), label,
				_('1 to 16 letters, digits, - or _. Used as file system label (shortened if the file system needs it) and folder name.')),
			field(_('File system'), fstype),
			E('p', {}, [ sure.node ]),
			modalButtons(ui.createHandlerFn(this, function() {
				if (!sure.input.checked)
					return warn(_('Tick the confirmation box first.'));
				if (!/^[A-Za-z0-9_-]{1,16}$/.test(label.value))
					return warn(_('Name: 1 to 16 letters, digits, - or _.'));
				return this.submit(callInit(disk.name, label.value, fstype.value));
			}), _('Erase and initialize'), true)
		]);
	},

	renderDisks: function() {
		const st = this.st;
		const table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('Disk') ]),
				E('th', { 'class': 'th' }, [ _('Model') ]),
				E('th', { 'class': 'th' }, [ _('Size') ]),
				E('th', { 'class': 'th' }, [ _('Partitions') ]),
				E('th', { 'class': 'th' }, '')
			])
		]);

		(st.disks || []).forEach(L.bind(function(d) {
			const parts = (d.partitions || []).map(function(p) {
				return E('div', {}, [ '%s: %s %s%s%s'.format(
					p.name, fmtSize(p.size), p.type || _('unknown'),
					p.label ? ' "' + p.label + '"' : '',
					p.mount ? ' → ' + p.mount : '') ]);
			});

			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [ '/dev/%s (%s)'.format(d.name, d.bus.toUpperCase()) ]),
				E('td', { 'class': 'td' }, [ [ d.vendor, d.model ].filter(Boolean).join(' ') ]),
				E('td', { 'class': 'td' }, [ fmtSize(d.size) ]),
				E('td', { 'class': 'td' }, parts.length ? parts : [ E('em', {}, [ _('none') ]) ]),
				E('td', { 'class': 'td' }, [ E('button', {
					'class': 'btn cbi-button-negative',
					'disabled': st.state == 'running' ? '' : null,
					'click': ui.createHandlerFn(this, 'confirmInit', d)
				}, [ _('Initialize...') ]) ])
			]));
		}, this));

		if (!(st.disks || []).length)
			table.appendChild(E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td', 'colspan': 5 },
				[ E('em', {}, [ _('No SATA or USB disk found.') ]) ]) ]));

		return table;
	},

	/* ---- shared folders ---- */

	editShare: function(f) {
		const sh = this.sh, svc = sh.services || {};
		const smb = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': 'off' }, [ _('Not shared') ]),
			E('option', { 'value': 'guest' }, [ _('Everyone, no password') ]),
			E('option', { 'value': 'users' }, [ _('Only these SMB users') ])
		]);
		smb.value = f.smb || 'off';
		const current = (f.smb_users || '').split(/\s+/);
		const users = (sh.smb_users || []).map(function(u) {
			return Object.assign(checkbox(current.indexOf(u) >= 0, u), { name: u });
		});
		const userBox = E('div', {}, users.length
			? users.map(function(u) { return E('div', {}, [ u.node ]); })
			: [ E('em', {}, [ _('No SMB users yet: add them under SMB users.') ]) ]);
		const smbRo = checkbox(f.smb_ro, _('Read-only'));
		const showUsers = function() { userBox.style.display = smb.value == 'users' ? '' : 'none'; };
		smb.addEventListener('change', showUsers);
		showUsers();

		const anon = sh.folders.filter(function(o) { return o.ftp_anon && o.path != f.path; })[0];
		const ftpAnon = checkbox(f.ftp_anon, _('Anonymous FTP, read-only'));

		const nfs = checkbox(f.nfs, _('Export over NFS'));
		const nfsClients = E('input', { 'type': 'text', 'class': 'cbi-input-text',
			'value': f.nfs_clients || sh.lan_subnet || '*' });
		const nfsRo = checkbox(f.nfs_ro, _('Read-only'));

		ui.showModal(_('Sharing of %s').format(f.path), [
			E('h4', {}, [ _('SMB (Windows, macOS, Linux file sharing)') ]),
			svc.smb ? E('div', {}, [
				field(_('Access'), smb),
				field(_('Users'), userBox),
				field('', smbRo.node)
			]) : E('p', {}, [ E('em', {}, [ _('ksmbd is not installed.') ]) ]),
			E('h4', {}, [ _('FTP') ]),
			svc.ftp ? E('div', {}, [
				field('', ftpAnon.node, anon
					? _('Only one folder can be the anonymous FTP folder; this moves it from %s.').format(anon.path)
					: _('Anyone can download from this folder without a password. FTP users get their folder under FTP users.'))
			]) : E('p', {}, [ E('em', {}, [ _('vsftpd is not installed.') ]) ]),
			E('h4', {}, [ _('NFS (Linux, macOS)') ]),
			svc.nfs ? E('div', {}, [
				field('', nfs.node),
				field(_('Clients'), nfsClients,
					_('Who may mount it: networks like 192.168.1.0/24, addresses or host names, separated by spaces, or * for everyone. Files are written as user nobody.')),
				field('', nfsRo.node)
			]) : E('p', {}, [ E('em', {}, [ _('nfs-kernel-server is not installed.') ]) ]),
			modalButtons(ui.createHandlerFn(this, function() {
				const chosen = users.filter(function(u) { return u.input.checked; })
					.map(function(u) { return u.name; });
				if (svc.smb && smb.value == 'users' && !chosen.length)
					return warn(_('Choose at least one SMB user, or another access.'));
				return this.submit(callSetShare(f.path, smb.value, chosen.join(' '),
					smbRo.input.checked, ftpAnon.input.checked, nfs.input.checked,
					nfsClients.value.trim(), nfsRo.input.checked));
			}), _('Save'))
		]);
	},

	renderFolders: function() {
		const sh = this.sh;
		const table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('Folder') ]),
				E('th', { 'class': 'th' }, [ _('Disk') ]),
				E('th', { 'class': 'th' }, [ _('Free') ]),
				E('th', { 'class': 'th' }, [ 'SMB' ]),
				E('th', { 'class': 'th' }, [ 'FTP' ]),
				E('th', { 'class': 'th' }, [ 'NFS' ]),
				E('th', { 'class': 'th' }, '')
			])
		]);

		(sh.folders || []).forEach(L.bind(function(f) {
			const ro = function(x) { return x ? ' (' + _('read-only') + ')' : ''; };
			const smb = {
				off: '-',
				guest: _('everyone') + ro(f.smb_ro),
				users: (f.smb_users || '').split(/\s+/).join(', ') + ro(f.smb_ro)
			}[f.smb] || '-';

			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [ f.path ]),
				E('td', { 'class': 'td' }, [ '%s, %s%s'.format(f.dev.replace('/dev/', ''), f.fstype,
					f.label ? ' "' + f.label + '"' : '') ]),
				E('td', { 'class': 'td' }, [ fmtSize(f.free) ]),
				E('td', { 'class': 'td' }, [ (f.smb != 'off' && f.smb_name ? '\\\\' + f.smb_name + ': ' : '') + smb ]),
				E('td', { 'class': 'td' }, [ f.ftp_anon ? _('anonymous, read-only') : '-' ]),
				E('td', { 'class': 'td' }, [ f.nfs ? f.nfs_clients + ro(f.nfs_ro) : '-' ]),
				E('td', { 'class': 'td' }, [ E('button', {
					'class': 'btn cbi-button-edit',
					'click': ui.createHandlerFn(this, 'editShare', f)
				}, [ _('Edit...') ]) ])
			]));
		}, this));

		if (!(sh.folders || []).length)
			table.appendChild(E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td', 'colspan': 7 },
				[ E('em', {}, [ _('No disk is mounted. Initialize one above, or mount it under System → Mount Points.') ]) ]) ]));

		return table;
	},

	/* ---- users ---- */

	editUser: function(service, user) {
		const sh = this.sh, add = !user;
		const name = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'maxlength': 32,
			'value': add ? '' : user.name, 'disabled': add ? null : '' });
		const pw1 = E('input', { 'type': 'password', 'class': 'cbi-input-password' });
		const pw2 = E('input', { 'type': 'password', 'class': 'cbi-input-password' });
		let root, write;
		const extra = [];

		if (service == 'ftp') {
			root = E('select', { 'class': 'cbi-input-select' }, [
				E('option', { 'value': '/mnt' }, [ _('/mnt - all disks') ])
			].concat((sh.folders || []).map(function(f) {
				return E('option', { 'value': f.path }, [ f.path ]);
			})));
			root.value = add ? '/mnt' : user.root;
			write = checkbox(add ? true : user.write, _('May upload, change and delete files'));
			extra.push(field(_('Folder'), root, _('The user sees only this folder.')),
				field('', write.node));
		}

		const title = service == 'smb'
			? (add ? _('Add SMB user') : _('SMB user %s').format(user.name))
			: (add ? _('Add FTP user') : _('FTP user %s').format(user.name));

		ui.showModal(title, [
			field(_('User name'), name, add ? _('Small letters, digits, - or _.') : null),
			field(_('Password'), pw1, add ? null : _('Leave empty to keep the current password.')),
			field(_('Repeat password'), pw2)
		].concat(extra, [
			modalButtons(ui.createHandlerFn(this, function() {
				if (pw1.value != pw2.value)
					return warn(_('The passwords do not match.'));
				if ((add || service == 'smb') && !pw1.value)
					return warn(_('Enter a password.'));
				return this.submit(callSetUser(service, add ? 'add' : 'set', name.value.trim(),
					pw1.value, root ? root.value : '', write ? write.input.checked : true));
			}), _('Save'))
		]));
	},

	deleteUser: function(service, name) {
		ui.showModal(_('Delete %s user %s').format(service.toUpperCase(), name), [
			E('p', {}, [ _('The user can no longer log in over %s. Files stay where they are.')
				.format(service.toUpperCase()) ]),
			modalButtons(ui.createHandlerFn(this, function() {
				return this.submit(callSetUser(service, 'delete', name, '', '', false));
			}), _('Delete'), true)
		]);
	},

	userTable: function(service, rows, cols) {
		const table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, cols.map(function(c) {
				return E('th', { 'class': 'th' }, [ c ]);
			}).concat([ E('th', { 'class': 'th' }, '') ]))
		]);

		rows.forEach(L.bind(function(r) {
			table.appendChild(E('tr', { 'class': 'tr' }, r.cells.map(function(c) {
				return E('td', { 'class': 'td' }, [ c ]);
			}).concat([ E('td', { 'class': 'td' }, [
				E('button', { 'class': 'btn cbi-button-edit',
					'click': ui.createHandlerFn(this, 'editUser', service, r.user) },
					[ service == 'smb' ? _('Password...') : _('Edit...') ]), ' ',
				E('button', { 'class': 'btn cbi-button-remove',
					'click': ui.createHandlerFn(this, 'deleteUser', service, r.user.name) },
					[ _('Delete') ])
			]) ])));
		}, this));

		if (!rows.length)
			table.appendChild(E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td', 'colspan': cols.length + 1 },
				[ E('em', {}, [ _('No users yet.') ]) ]) ]));

		return E([
			table,
			E('div', { 'class': 'cbi-section-create' }, [ E('button', {
				'class': 'btn cbi-button-add',
				'click': ui.createHandlerFn(this, 'editUser', service, null)
			}, [ _('Add user...') ]) ])
		]);
	},

	renderSmbUsers: function() {
		if (!(this.sh.services || {}).smb)
			return E('em', {}, [ _('ksmbd is not installed.') ]);
		return this.userTable('smb', (this.sh.smb_users || []).map(function(u) {
			return { user: { name: u }, cells: [ u ] };
		}), [ _('User') ]);
	},

	renderFtpUsers: function() {
		if (!(this.sh.services || {}).ftp)
			return E('em', {}, [ _('vsftpd is not installed.') ]);
		return this.userTable('ftp', (this.sh.ftp_users || []).map(function(u) {
			return { user: u, cells: [ u.name, u.root,
				u.write ? _('read and write') : _('read-only') ] };
		}), [ _('User'), _('Folder'), _('Access') ]);
	},

	section: function(title, descr, node) {
		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [ title ]),
			descr ? E('p', { 'class': 'cbi-section-descr' }, [ descr ]) : '',
			node
		]);
	},

	render: function(res) {
		this.st = res[0];
		this.sh = res[1];
		this.nodes = {
			log: E('div', { 'style': 'display:none' }),
			disks: E('div', {}, this.renderDisks()),
			folders: E('div', {}, this.renderFolders()),
			smbUsers: E('div', {}, this.renderSmbUsers()),
			ftpUsers: E('div', {}, this.renderFtpUsers())
		};
		this.renderLog();

		let last = this.st.state;
		poll.add(L.bind(function() {
			return callStatus().then(L.bind(function(s) {
				const finished = last == 'running' && s.state != 'running';
				last = s.state;
				if (finished)
					return this.refresh();
				this.st = s;
				this.renderLog();
				this.nodes.disks.replaceChildren(this.renderDisks());
			}, this));
		}, this), 3);

		return E([
			E('h2', {}, [ _('Storage') ]),
			E('p', { 'class': 'cbi-section-descr' }, [
				_('Prepare disks and share them on the network over SMB, FTP and NFS. The settings are stored in the usual OpenWrt places, so Services → Network Shares and the configuration files show the same.') ]),
			this.nodes.log,
			this.section(_('Disks'),
				_('Initialize erases a disk and gives it one partition with a file system of your choice, mounted at boot. Disks that already hold data can be mounted under System → Mount Points instead.'),
				this.nodes.disks),
			this.section(_('Shared folders'), null, this.nodes.folders),
			this.section(_('SMB users'),
				_('Accounts for SMB shares limited to users. They cannot log in to the router itself.'),
				this.nodes.smbUsers),
			this.section(_('FTP users'),
				_('Accounts for FTP, separate from the SMB users and with their own password; a name can be in both lists. Each user is locked into one folder.'),
				this.nodes.ftpUsers)
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
