       // ================= KONFIGURASI SUPABASE =================
        const SUPABASE_URL = 'https://dhhptyzyjiqjhwfayzyh.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_CzOeKPNQ1Auk8fw_I79XFA_CD0EVOPq';
        const TABLE_NAME = 'uib_lnf';
        const ADMIN_EMAIL = 'admin@uib.edu';

        const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        document.addEventListener('DOMContentLoaded', function() {
            let items = [];
            let currentFilter = 'all';
            let currentUser = null;

            const categoryIcons = {
                'Dokumen & KTM': '🪪',
                'Elektronik': '💻',
                'Kunci & Aksesoris': '🔑',
                'Perlengkapan Pribadi': '🎒'
            };

            function isAdmin() {
                return Boolean(currentUser && (currentUser.email || '').toLowerCase() === ADMIN_EMAIL);
            }

            function showToast(msg) {
                const toast = document.getElementById('toast');
                toast.textContent = msg;
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 2800);
            }

            function switchPage(pageId) {
                if (!currentUser && pageId !== 'login') {
                    pageId = 'login';
                }

                document.querySelectorAll('.page-view').forEach(page => page.classList.remove('active'));
                const targetPage = document.getElementById('view-' + pageId);
                if (targetPage) targetPage.classList.add('active');

                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.toggle('active', link.getAttribute('data-goto') === pageId);
                });

                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (pageId === 'katalog') renderCatalog();
                updateStats();
            }

            // ================= AUTH STATE =================
            function updateAuthUI() {
                const portalNav = document.getElementById('portalNav');
                const authBadge = document.getElementById('authBadge');
                const submitBtn = document.getElementById('submitReportBtn');
                const archiveBtn = document.getElementById('archiveFilterBtn');
                const subtitle = document.getElementById('catalogSubtitle');

                if (currentUser) {
                    portalNav.style.display = 'flex';
                    authBadge.style.display = 'inline-flex';

                    if (isAdmin()) {
                        authBadge.classList.add('admin');
                        authBadge.textContent = `🛡️ Admin (${currentUser.email})`;
                        archiveBtn.style.display = 'inline-block';
                        subtitle.textContent = 'Mode Admin: kelola barang aktif, catat pengambil, atau cek arsip selesai';
                    } else {
                        authBadge.classList.remove('admin');
                        authBadge.textContent = `✅ ${currentUser.email}`;
                        archiveBtn.style.display = 'none';
                        if (currentFilter === 'done') {
                            currentFilter = 'all';
                            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                            document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
                        }
                        subtitle.textContent = 'Cari barang temuan atau laporan kehilangan aktif di UIB';
                    }

                    submitBtn.disabled = false;

                    const activeView = document.querySelector('.page-view.active');
                    if (!activeView || activeView.id === 'view-login') {
                        switchPage('beranda');
                    }
                } else {
                    portalNav.style.display = 'none';
                    authBadge.style.display = 'none';
                    archiveBtn.style.display = 'none';
                    submitBtn.disabled = true;
                    switchPage('login');
                }

                updateStats();
                renderCatalog();
            }

            async function initSession() {
                const { data: { session } } = await supabaseClient.auth.getSession();
                currentUser = session ? session.user : null;
                updateAuthUI();

                supabaseClient.auth.onAuthStateChange((_event, session) => {
                    currentUser = session ? session.user : null;
                    updateAuthUI();
                });
            }

            document.getElementById('fillDemoBtn').addEventListener('click', () => {
                document.getElementById('loginEmail').value = 'demo@uib.edu';
                document.getElementById('loginPassword').value = 'uib123';
                showToast('⚡ Kredensial demo terisi.');
            });

            document.getElementById('loginForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value.trim().toLowerCase();
                const password = document.getElementById('loginPassword').value;

                if (!email.endsWith('@uib.edu') && !email.endsWith('@uib.ac.id') && email !== ADMIN_EMAIL) {
                    showToast('❌ Gunakan email resmi UIB (@uib.edu / @uib.ac.id) atau akun admin.');
                    return;
                }

                const btn = document.getElementById('loginSubmitBtn');
                btn.disabled = true;
                btn.textContent = 'Memproses...';

                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

                btn.disabled = false;
                btn.textContent = '🔐 Masuk & Lanjutkan';

                if (error) {
                    showToast('❌ Login gagal: ' + error.message);
                    return;
                }

                currentUser = data.user;
                updateAuthUI();
                showToast('✅ Berhasil login sebagai ' + data.user.email);
                switchPage('beranda');
            });

            document.getElementById('logoutBtn').addEventListener('click', async () => {
                await supabaseClient.auth.signOut();
                showToast('👋 Kamu telah keluar.');
                switchPage('login');
            });

            // ================= FETCH DATA DARI SUPABASE =================
            async function fetchItems() {
                const { data, error } = await supabaseClient
                    .from(TABLE_NAME)
                    .select('*')
                    .order('id', { ascending: false });

                if (error) {
                    console.error('Supabase fetch error:', error);
                    return;
                }

                items = (data || []).map(row => ({
                    id: row.id,
                    type: row.jenis_laporan,
                    name: row.nama_barang,
                    category: row.kategori,
                    location: row.lokasi_di_uib,
                    contact: row.no_whatsapp_aktif,
                    status: row.status || 'aktif',
                    pickerName: row.nama_pengambil || '',
                    completedAt: row.waktu_selesai || '',
                    icon: categoryIcons[row.kategori] || '📦'
                }));

                updateStats();
                renderCatalog();
            }

            // ================= NAVIGASI & RIPPLE =================
            document.querySelectorAll('[data-goto]').forEach(el => {
                el.addEventListener('click', function() {
                    switchPage(this.getAttribute('data-goto'));
                });
            });

            document.body.addEventListener('click', function(e) {
                const btn = e.target.closest('.btn, .nav-link, .filter-btn');
                if (!btn) return;

                const ripple = document.createElement('span');
                const diameter = Math.max(btn.clientWidth, btn.clientHeight);
                const radius = diameter / 2;
                const rect = btn.getBoundingClientRect();

                ripple.style.width = ripple.style.height = `${diameter}px`;
                ripple.style.left = `${e.clientX - rect.left - radius}px`;
                ripple.style.top = `${e.clientY - rect.top - radius}px`;
                ripple.classList.add('ripple');

                const existing = btn.querySelector('.ripple');
                if (existing) existing.remove();
                btn.appendChild(ripple);
            });

            // ================= STATISTIK & KATALOG =================
            function getActiveItems() {
                return items.filter(i => i.status !== 'selesai');
            }

            function updateStats() {
                const activeItems = getActiveItems();
                document.getElementById('statTotal').textContent = activeItems.length;
                document.getElementById('statFound').textContent = activeItems.filter(i => i.type === 'found').length;
                document.getElementById('statLost').textContent = activeItems.filter(i => i.type === 'lost').length;
            }

            function formatDateTime(isoStr) {
                if (!isoStr) return '-';
                const d = new Date(isoStr);
                if (isNaN(d.getTime())) return isoStr;
                return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
            }

            function createCardHTML(item) {
                const isDone = item.status === 'selesai';
                const isFound = item.type === 'found';
                const admin = isAdmin();

                let statusBadge = isFound
                    ? '<span class="badge-status">🟢 Ditemukan</span>'
                    : '<span class="badge-status badge-lost">🟠 Dicari</span>';

                if (isDone) {
                    statusBadge = '<span class="badge-status badge-done">📁 Selesai</span>';
                }

                const archiveInfo = isDone && admin
                    ? `<div class="archive-box">
                        <div><strong>Pengambil:</strong> ${item.pickerName || '-'}</div>
                        <div><strong>Waktu Selesai:</strong> ${formatDateTime(item.completedAt)}</div>
                       </div>`
                    : '';

                const adminControls = admin
                    ? `<div class="admin-actions">
                        ${!isDone
                            ? `<button type="button" class="btn btn-success btn-sm complete-btn" data-id="${item.id}" data-name="${item.name}">✅ Tandai Selesai</button>`
                            : `<button type="button" class="btn btn-outline btn-sm reopen-btn" data-id="${item.id}">↩️ Aktifkan Lagi</button>`
                        }
                        <button type="button" class="btn btn-danger btn-sm delete-btn" data-id="${item.id}" data-name="${item.name}">🗑️</button>
                       </div>`
                    : '';

                return `
                    <div class="item-card">
                        <div class="item-thumb">
                            ${statusBadge}
                            ${item.icon || '📦'}
                        </div>
                        <div class="item-body">
                            <div class="item-category">${item.category}</div>
                            <h3 class="item-title">${item.name}</h3>
                            <div class="item-meta">
                                <span>📍 ${item.location}</span>
                                ${archiveInfo}
                            </div>
                            <div class="item-footer">
                                <button type="button" class="btn btn-primary contact-btn" data-contact="${item.contact}" data-name="${item.name}">
                                    💬 Hubungi (${item.contact})
                                </button>
                                ${adminControls}
                            </div>
                        </div>
                    </div>
                `;
            }

            function renderCatalog() {
                const keyword = document.getElementById('searchInput').value.toLowerCase();
                const showArchive = currentFilter === 'done' && isAdmin();

                const filtered = items.filter(item => {
                    const isDone = item.status === 'selesai';
                    if (showArchive && !isDone) return false;
                    if (!showArchive && isDone) return false;

                    const matchText = (item.name || '').toLowerCase().includes(keyword) ||
                                      (item.location || '').toLowerCase().includes(keyword);
                    const matchType = currentFilter === 'all' || currentFilter === 'done' || item.type === currentFilter;
                    return matchText && matchType;
                });

                const grid = document.getElementById('catalogGrid');
                grid.innerHTML = filtered.length
                    ? filtered.map(i => createCardHTML(i)).join('')
                    : `<p style="color:var(--text-muted); grid-column:1/-1; text-align:center; padding:2rem;">
                        ${showArchive ? 'Belum ada barang di arsip selesai.' : 'Belum ada laporan barang yang cocok.'}
                       </p>`;
            }

            document.getElementById('searchInput').addEventListener('input', renderCatalog);

            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const targetFilter = this.getAttribute('data-filter');
                    if (targetFilter === 'done' && !isAdmin()) {
                        showToast('🔒 Arsip selesai hanya untuk Admin.');
                        return;
                    }
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    currentFilter = targetFilter;
                    renderCatalog();
                });
            });

            // ================= AKSI ADMIN (SELESAI, AKTIFKAN LAGI, HAPUS) =================
            const completeModal = document.getElementById('completeModal');

            document.body.addEventListener('click', async function(e) {
                const contactBtn = e.target.closest('.contact-btn');
                if (contactBtn) {
                    const phone = contactBtn.getAttribute('data-contact');
                    const name = contactBtn.getAttribute('data-name');
                    alert(`Informasi Kontak untuk "${name}":\n\nNomor WhatsApp: ${phone}`);
                    return;
                }

                const completeBtn = e.target.closest('.complete-btn');
                if (completeBtn) {
                    if (!isAdmin()) return;
                    document.getElementById('completeItemId').value = completeBtn.getAttribute('data-id');
                    document.getElementById('completeModalItemName').textContent = `Barang: ${completeBtn.getAttribute('data-name')}`;
                    document.getElementById('pickerName').value = '';
                    completeModal.classList.add('show');
                    document.getElementById('pickerName').focus();
                    return;
                }

                const reopenBtn = e.target.closest('.reopen-btn');
                if (reopenBtn) {
                    if (!isAdmin()) return;
                    const id = reopenBtn.getAttribute('data-id');
                    const { error } = await supabaseClient
                        .from(TABLE_NAME)
                        .update({ status: 'aktif', nama_pengambil: null, waktu_selesai: null })
                        .eq('id', id);

                    if (error) {
                        showToast('❌ Gagal mengaktifkan kembali: ' + error.message);
                        return;
                    }
                    showToast('↩️ Barang diaktifkan kembali ke katalog.');
                    await fetchItems();
                    return;
                }

                const deleteBtn = e.target.closest('.delete-btn');
                if (deleteBtn) {
                    if (!isAdmin()) return;
                    const id = deleteBtn.getAttribute('data-id');
                    const name = deleteBtn.getAttribute('data-name');
                    const yakin = confirm(`Hapus permanen laporan "${name}"? Gunakan ini khusus untuk spam/laporan tidak valid.`);
                    if (!yakin) return;

                    const { error } = await supabaseClient
                        .from(TABLE_NAME)
                        .delete()
                        .eq('id', id);

                    if (error) {
                        showToast('❌ Gagal menghapus (cek RLS Admin): ' + error.message);
                        return;
                    }
                    showToast('🗑️ Laporan berhasil dihapus.');
                    await fetchItems();
                }
            });

            document.getElementById('cancelCompleteBtn').addEventListener('click', () => {
                completeModal.classList.remove('show');
            });

            completeModal.addEventListener('click', (e) => {
                if (e.target === completeModal) completeModal.classList.remove('show');
            });

            document.getElementById('completeForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                if (!isAdmin()) return;

                const id = document.getElementById('completeItemId').value;
                const pickerName = document.getElementById('pickerName').value.trim();
                if (!pickerName) return;

                const btn = document.getElementById('saveCompleteBtn');
                btn.disabled = true;
                btn.textContent = 'Menyimpan...';

                const { error } = await supabaseClient
                    .from(TABLE_NAME)
                    .update({
                        status: 'selesai',
                        nama_pengambil: pickerName,
                        waktu_selesai: new Date().toISOString()
                    })
                    .eq('id', id);

                btn.disabled = false;
                btn.textContent = 'Simpan & Arsipkan';

                if (error) {
                    showToast('❌ Gagal menandai selesai (cek RLS Admin): ' + error.message);
                    return;
                }

                completeModal.classList.remove('show');
                showToast('✅ Barang ditandai selesai dan masuk arsip admin.');
                await fetchItems();
            });

            // ================= SUBMIT LAPORAN KE SUPABASE =================
            document.getElementById('reportForm').addEventListener('submit', async function(e) {
                e.preventDefault();

                if (!currentUser) {
                    showToast('🔒 Silakan login akun UIB terlebih dahulu.');
                    switchPage('login');
                    return;
                }

                const payload = {
                    jenis_laporan: document.getElementById('reportType').value,
                    nama_barang: document.getElementById('itemName').value.trim(),
                    kategori: document.getElementById('itemCategory').value,
                    lokasi_di_uib: document.getElementById('itemLocation').value.trim(),
                    no_whatsapp_aktif: document.getElementById('itemContact').value.trim(),
                    status: 'aktif'
                };

                const btn = document.getElementById('submitReportBtn');
                btn.disabled = true;
                btn.textContent = 'Mengirim...';

                const { error } = await supabaseClient
                    .from(TABLE_NAME)
                    .insert([payload]);

                btn.disabled = false;
                btn.textContent = '🚀 Publikasikan Laporan';

                if (error) {
                    console.error('Insert error:', error);
                    showToast('❌ Gagal mengirim laporan: ' + error.message);
                    return;
                }

                this.reset();
                showToast('✅ Laporan berhasil dipublikasikan ke Supabase!');
                await fetchItems();
                switchPage('katalog');
            });

            // Jalankan saat halaman dimuat
            initSession();
            fetchItems();
        });