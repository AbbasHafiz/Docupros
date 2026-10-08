package app.docupros.scanner;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Ensure the WebView can drive Android's system print dialog from JS.
    if (getBridge() != null && getBridge().getWebView() != null) {
      WebSettings settings = getBridge().getWebView().getSettings();
      settings.setJavaScriptEnabled(true);
      settings.setDomStorageEnabled(true);
      settings.setLoadWithOverviewMode(true);
      settings.setUseWideViewPort(true);
    }
  }
}
