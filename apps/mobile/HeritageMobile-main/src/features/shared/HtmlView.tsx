import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../../theme';
import { appConfig } from '../../config/appConfig';

const CSS = `body{margin:0;padding:12px 14px;font:15px/1.55 -apple-system,Helvetica,sans-serif;color:${colors.ink};background:${colors.surface};word-wrap:break-word}h1,h2,h3,h4{color:${colors.green900};line-height:1.3}h2{font-size:19px}h3{font-size:17px}table{border-collapse:collapse;width:100%}td,th{border:1px solid ${colors.border};padding:6px;text-align:left}summary{color:${colors.coral600};font-weight:600}img{max-width:100%}`;

export function HtmlView({ html, testID }: { html: string; testID?: string }) {
  const [height, setHeight] = useState(240);
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${CSS}</style></head><body>${html}<script>(function(){function p(){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(String(document.documentElement.scrollHeight))}window.addEventListener('load',p);document.addEventListener('toggle',p,true);if(window.ResizeObserver)new ResizeObserver(p).observe(document.body);setTimeout(p,300)})();</script></body></html>`;
  return (
    <View style={{ height }} testID={testID}>
      <WebView
        originWhitelist={['*']}
        source={{ html: doc, baseUrl: appConfig.webOrigin }}
        scrollEnabled={false}
        onMessage={e => setHeight(Math.max(60, Number(e.nativeEvent.data) || 0))}
        onShouldStartLoadWithRequest={req => {
          if (/^https?:/i.test(req.url) && req.navigationType === 'click') { void Linking.openURL(req.url); return false; }
          return true;
        }}
        style={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
}
