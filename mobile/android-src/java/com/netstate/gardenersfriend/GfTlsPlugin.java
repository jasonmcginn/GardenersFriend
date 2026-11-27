package com.netstate.gardenersfriend;

import android.content.SharedPreferences;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.net.URL;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.cert.Certificate;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLException;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;

/**
 * HTTPS to the Gardener's Friend desktop. The desktop makes its own certificate, which no phone trusts by default, so the app
 * pins the desktop's key instead: the "security code" shown on the desktop (Settings › Phones and computers) and in its QR code.
 * A connection is accepted when the server's key is one this phone pinned when pairing; anything else must pass Android's normal checks.
 *   probe({host, port})        → { pin, subject, issuer, notAfter }   reads the key without trusting it (to show the code before pairing)
 *   pin({pin}) / list() / clear()                                     the pinned keys (base64 SHA-256 of the public key)
 *   request({url, method, headers, body | bodyBase64, timeout}) → { status, headers, data (base64) }
 *   scan({port, timeout})      → { nets: [{name, address, prefix}], found: [{host, pin}] }
 *       Only when the person taps Search this network: tries port on every address of the Wi-Fi, hotspot or USB/Bluetooth
 *       tether networks this phone is on (a /24 around its own address on each, never mobile data) and reads the key of
 *       whatever answers. The page uses the one whose key matches the pinned desktop. Nothing is trusted or sent here.
 */
@CapacitorPlugin(name = "GfTls")
public class GfTlsPlugin extends Plugin {
    private final ExecutorService pool = Executors.newFixedThreadPool(4);

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences("gf_tls", 0);
    }

    private Set<String> pins() {
        return new HashSet<>(prefs().getStringSet("pins", new HashSet<String>()));
    }

    static String pinOf(Certificate c) throws Exception {
        byte[] h = MessageDigest.getInstance("SHA-256").digest(c.getPublicKey().getEncoded());
        return Base64.encodeToString(h, Base64.NO_WRAP);
    }

    private static X509TrustManager systemTrust() throws Exception {
        TrustManagerFactory f = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        f.init((KeyStore) null);
        for (TrustManager t : f.getTrustManagers()) if (t instanceof X509TrustManager) return (X509TrustManager) t;
        throw new IllegalStateException("No system trust manager");
    }

    private static SSLSocketFactory pinnedFactory(final Set<String> pins) throws Exception {
        final X509TrustManager sys = systemTrust();
        TrustManager tm = new X509TrustManager() {
            @Override
            public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                sys.checkClientTrusted(chain, authType);
            }

            @Override
            public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
                try {
                    if (chain != null && chain.length > 0 && pins.contains(pinOf(chain[0]))) return;
                } catch (Exception ignored) {
                }
                sys.checkServerTrusted(chain, authType);
            }

            @Override
            public X509Certificate[] getAcceptedIssuers() {
                return sys.getAcceptedIssuers();
            }
        };
        SSLContext ctx = SSLContext.getInstance("TLS");
        ctx.init(null, new TrustManager[] { tm }, null);
        return ctx.getSocketFactory();
    }

    private static HostnameVerifier pinnedVerifier(final Set<String> pins) {
        return (host, session) -> {
            try {
                Certificate[] pc = session.getPeerCertificates();
                if (pc.length > 0 && pins.contains(pinOf(pc[0]))) return true;
            } catch (Exception ignored) {
            }
            return HttpsURLConnection.getDefaultHostnameVerifier().verify(host, session);
        };
    }

    @PluginMethod
    public void pin(PluginCall call) {
        String p = call.getString("pin");
        if (p == null || p.isEmpty()) {
            call.reject("No pin");
            return;
        }
        Set<String> s = pins();
        s.add(p);
        prefs().edit().putStringSet("pins", s).apply();
        call.resolve();
    }

    @PluginMethod
    public void list(PluginCall call) {
        JSObject r = new JSObject();
        r.put("pins", new JSArray(pins()));
        call.resolve(r);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        prefs().edit().remove("pins").apply();
        call.resolve();
    }

    @PluginMethod
    public void probe(final PluginCall call) {
        final String host = call.getString("host");
        final int port = call.getInt("port", 4749);
        pool.execute(() -> {
            SSLSocket s = null;
            try {
                SSLContext ctx = SSLContext.getInstance("TLS");
                ctx.init(null, new TrustManager[] { new X509TrustManager() {
                    @Override
                    public void checkClientTrusted(X509Certificate[] c, String a) {}

                    @Override
                    public void checkServerTrusted(X509Certificate[] c, String a) {}

                    @Override
                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[0];
                    }
                } }, null);
                s = (SSLSocket) ctx.getSocketFactory().createSocket();
                s.connect(new InetSocketAddress(host, port), 6000);
                s.setSoTimeout(6000);
                s.startHandshake();
                X509Certificate x = (X509Certificate) s.getSession().getPeerCertificates()[0];
                JSObject r = new JSObject();
                r.put("pin", pinOf(x));
                r.put("subject", x.getSubjectX500Principal().getName());
                r.put("issuer", x.getIssuerX500Principal().getName());
                r.put("notAfter", x.getNotAfter().getTime());
                call.resolve(r);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()), "NET");
            } finally {
                try {
                    if (s != null) s.close();
                } catch (Exception ignored) {
                }
            }
        });
    }

    @PluginMethod
    public void request(final PluginCall call) {
        final String url = call.getString("url");
        final String method = call.getString("method", "GET");
        final JSObject headers = call.getObject("headers", new JSObject());
        final String body = call.getString("body");
        final String bodyB64 = call.getString("bodyBase64");
        final int timeout = call.getInt("timeout", 15000);
        pool.execute(() -> {
            HttpURLConnection con = null;
            try {
                con = (HttpURLConnection) new URL(url).openConnection();
                if (con instanceof HttpsURLConnection) {
                    Set<String> p = pins();
                    ((HttpsURLConnection) con).setSSLSocketFactory(pinnedFactory(p));
                    ((HttpsURLConnection) con).setHostnameVerifier(pinnedVerifier(p));
                }
                con.setConnectTimeout(Math.min(timeout, 10000));
                con.setReadTimeout(timeout);
                con.setInstanceFollowRedirects(false);
                con.setUseCaches(false);
                // HttpURLConnection has no PATCH: send POST and say which method it is (the desktop honours the override).
                String m = method.toUpperCase(Locale.ROOT);
                if (m.equals("PATCH")) {
                    con.setRequestMethod("POST");
                    con.setRequestProperty("X-HTTP-Method-Override", "PATCH");
                } else con.setRequestMethod(m);
                Iterator<String> keys = headers.keys();
                while (keys.hasNext()) {
                    String k = keys.next();
                    con.setRequestProperty(k, headers.getString(k));
                }
                byte[] out = bodyB64 != null ? Base64.decode(bodyB64, Base64.DEFAULT) : body != null ? body.getBytes("UTF-8") : null;
                if (out != null && !m.equals("GET") && !m.equals("HEAD")) {
                    con.setDoOutput(true);
                    con.setFixedLengthStreamingMode(out.length);
                    OutputStream os = con.getOutputStream();
                    os.write(out);
                    os.close();
                }
                int status = con.getResponseCode();
                InputStream in = status >= 400 ? con.getErrorStream() : con.getInputStream();
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                if (in != null) {
                    byte[] b = new byte[16384];
                    int n;
                    while ((n = in.read(b)) > 0) buf.write(b, 0, n);
                    in.close();
                }
                JSObject h = new JSObject();
                for (Map.Entry<String, List<String>> e : con.getHeaderFields().entrySet()) {
                    if (e.getKey() == null) continue;
                    StringBuilder v = new StringBuilder();
                    for (String x : e.getValue()) v.append(v.length() > 0 ? ", " : "").append(x);
                    h.put(e.getKey().toLowerCase(Locale.ROOT), v.toString());
                }
                JSObject r = new JSObject();
                r.put("status", status);
                r.put("headers", h);
                r.put("data", Base64.encodeToString(buf.toByteArray(), Base64.NO_WRAP));
                call.resolve(r);
            } catch (SSLException e) {
                call.reject("This desktop's security code doesn't match the one this phone trusts. " + e.getMessage(), "TLS");
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()), "NET");
            } finally {
                if (con != null) con.disconnect();
            }
        });
    }

    // Wi-Fi, the phone's own hotspot, USB and Bluetooth tethering. Mobile data (rmnet, ccmni, clat…) and VPNs are never searched.
    private static final Pattern LOCAL_IF = Pattern.compile("^(wlan|ap|swlan|softap|wigig|rndis|ncm|usb|bt-pan|eth).*", Pattern.CASE_INSENSITIVE);

    private static SSLContext readOnlyTls() throws Exception {
        SSLContext ctx = SSLContext.getInstance("TLS");
        ctx.init(null, new TrustManager[] { new X509TrustManager() {
            @Override
            public void checkClientTrusted(X509Certificate[] c, String a) {}

            @Override
            public void checkServerTrusted(X509Certificate[] c, String a) {}

            @Override
            public X509Certificate[] getAcceptedIssuers() {
                return new X509Certificate[0];
            }
        } }, null);
        return ctx;
    }

    @PluginMethod
    public void scan(final PluginCall call) {
        final int port = call.getInt("port", 4749);
        final int connectMs = Math.max(150, Math.min(call.getInt("timeout", 600), 3000));
        new Thread(() -> {
            ExecutorService ex = null;
            try {
                JSArray nets = new JSArray();
                LinkedHashMap<String, Boolean> targets = new LinkedHashMap<>();
                Set<String> own = new HashSet<>();
                Set<String> bases = new HashSet<>();
                for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                    if (!ni.isUp() || ni.isLoopback() || !LOCAL_IF.matcher(ni.getName()).matches()) continue;
                    for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                        InetAddress a = ia.getAddress();
                        if (!(a instanceof Inet4Address) || !a.isSiteLocalAddress()) continue;
                        byte[] b = a.getAddress();
                        String ip = a.getHostAddress();
                        own.add(ip);
                        // At most a /24 around this phone's address, however large the network is (and at most 3 networks).
                        String base = (b[0] & 255) + "." + (b[1] & 255) + "." + (b[2] & 255) + ".";
                        if (!bases.add(base) || bases.size() > 3) continue;
                        JSObject n = new JSObject();
                        n.put("name", ni.getName());
                        n.put("address", ip);
                        n.put("prefix", (int) ia.getNetworkPrefixLength());
                        nets.put(n);
                        for (int i = 1; i < 255; i++) targets.put(base + i, true);
                    }
                }
                for (String o : own) targets.remove(o);
                ex = Executors.newFixedThreadPool(48);
                final SSLSocketFactory tls = readOnlyTls().getSocketFactory();
                List<Future<JSObject>> jobs = new ArrayList<>();
                for (final String host : targets.keySet()) {
                    jobs.add(ex.submit(() -> {
                        Socket raw = new Socket();
                        SSLSocket s = null;
                        try {
                            raw.connect(new InetSocketAddress(host, port), connectMs);
                            raw.setSoTimeout(4000);
                            JSObject r = new JSObject();
                            r.put("host", host);
                            try {
                                s = (SSLSocket) tls.createSocket(raw, host, port, true);
                                s.startHandshake();
                                r.put("pin", pinOf(s.getSession().getPeerCertificates()[0]));
                            } catch (Exception e) {
                                r.put("pin", "");   // something answered on the port, but not with HTTPS
                            }
                            return r;
                        } catch (Exception e) {
                            return null;
                        } finally {
                            try {
                                if (s != null) s.close();
                                raw.close();
                            } catch (Exception ignored) {
                            }
                        }
                    }));
                }
                JSArray found = new JSArray();
                for (Future<JSObject> f : jobs) {
                    try {
                        JSObject r = f.get(connectMs + 8000, TimeUnit.MILLISECONDS);
                        if (r != null) found.put(r);
                    } catch (Exception ignored) {
                    }
                }
                JSObject out = new JSObject();
                out.put("nets", nets);
                out.put("found", found);
                out.put("tried", targets.size());
                call.resolve(out);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()), "NET");
            } finally {
                if (ex != null) ex.shutdownNow();
            }
        }).start();
    }
}
