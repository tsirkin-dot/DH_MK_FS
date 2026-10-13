/* PIN gate on entry. Client-side only: hides the demo from casual visitors, not a security boundary. */
(function () {
  var PIN = '0084', KEY = 'orca9-pin-ok';
  var ok = false;
  try { ok = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
  if (ok) return;

  var root = document.documentElement;
  root.classList.add('pin-locked');
  var css = document.createElement('style');
  css.textContent =
    'html.pin-locked body>*:not(#orca9-pin){display:none!important}' +
    '#orca9-pin{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;' +
      'background:#181f30;font-family:Onest,system-ui,-apple-system,"Segoe UI",sans-serif;color:#202738}' +
    '#orca9-pin form{background:#fff;border-radius:14px;padding:28px 26px;width:100%;max-width:320px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.35)}' +
    '#orca9-pin h1{font-family:Unbounded,Onest,system-ui,sans-serif;font-size:22px;font-weight:600;margin:0 0 6px;letter-spacing:-.5px}' +
    '#orca9-pin p{margin:0 0 18px;font-size:14px;color:#596477}' +
    '#orca9-pin input{width:100%;box-sizing:border-box;font:inherit;font-size:24px;letter-spacing:.5em;text-align:center;padding:10px 0 10px .5em;' +
      'border:1px solid #cbd2df;border-radius:10px;outline:none}' +
    '#orca9-pin input:focus{border-color:#4857ba;box-shadow:0 0 0 3px #edf0ff}' +
    '#orca9-pin button{margin-top:14px;width:100%;font:inherit;font-weight:600;padding:11px;border:0;border-radius:10px;background:#4857ba;color:#fff;cursor:pointer}' +
    '#orca9-pin .err{min-height:20px;margin:10px 0 0;font-size:13px;color:#ad4039}' +
    '#orca9-pin.shake form{animation:orca9-shake .35s}' +
    '@keyframes orca9-shake{20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}';
  document.head.appendChild(css);

  function mount() {
    var wrap = document.createElement('div');
    wrap.id = 'orca9-pin';
    wrap.innerHTML =
      '<form autocomplete="off">' +
        '<h1>Orca9</h1>' +
        '<p>Введіть PIN для входу</p>' +
        '<input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" aria-label="PIN" required>' +
        '<button type="submit">Увійти</button>' +
        '<div class="err" role="alert"></div>' +
      '</form>';
    document.body.appendChild(wrap);
    var form = wrap.querySelector('form'), input = wrap.querySelector('input'), err = wrap.querySelector('.err');

    function check() {
      if (input.value === PIN) {
        try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
        root.classList.remove('pin-locked');
        wrap.remove();
        return;
      }
      err.textContent = 'Невірний PIN';
      input.value = '';
      wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake');
      input.focus();
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); check(); });
    input.addEventListener('input', function () {
      input.value = input.value.replace(/\D/g, '');
      err.textContent = '';
      if (input.value.length === 4) check();
    });
    input.focus();
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
