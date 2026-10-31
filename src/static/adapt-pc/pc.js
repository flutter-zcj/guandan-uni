/*
 * @Author: YangBo
 * @Date: 2023-07-05 10:18:07
 * @LastEditors: YangBo
 * @LastEditTime: 2023-07-05 10:18:31
 * @FilePath: \dmcxc_pc\static\adapt-pc\pc.js
 */
;(function(){
	if(window.innerWidth < 768){
		return;
	}
	var tpl = document.querySelector("#tpl-adapt-pc").innerHTML || '';
	tpl = tpl.replace('helang-mobile-href',window.location.href);
	document.querySelector("uni-adapt-pc").innerHTML = tpl;
	document.body.setAttribute("adapt","pc");
})();